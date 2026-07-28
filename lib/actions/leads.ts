"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";

import {
  evaluateLead,
  type EvaluateLeadProperty,
} from "@/lib/billing/evaluate-lead";
import { db } from "@/lib/db";
import {
  billableStatusEnum,
  leads,
  leadSourceEnum,
  leadTypeEnum,
  properties,
} from "@/lib/db/schema";
import { normalizePhone } from "@/lib/phone";
import { toMoneyString } from "@/lib/money";
import { getOrgTimezone } from "@/lib/settings";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

const createLeadSchema = z.object({
  propertyId: z.string().uuid("Select a property."),
  type: z.enum(leadTypeEnum.enumValues),
  source: z.enum(leadSourceEnum.enumValues),
  callerName: optionalText,
  callerPhone: optionalText,
  callerEmail: optionalText,
  message: optionalText,
  callDurationSeconds: z
    .string()
    .trim()
    .optional()
    .transform((v) => {
      if (!v) return null;
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= 0 ? n : null;
    }),
  occurredAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function createLead(formData: FormData): Promise<ActionResult> {
  const parsed = createLeadSchema.safeParse({
    propertyId: formData.get("propertyId"),
    type: formData.get("type"),
    source: formData.get("source"),
    callerName: formData.get("callerName"),
    callerPhone: formData.get("callerPhone"),
    callerEmail: formData.get("callerEmail"),
    message: formData.get("message"),
    callDurationSeconds: formData.get("callDurationSeconds"),
    occurredAt: formData.get("occurredAt"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, data.propertyId))
    .limit(1);
  if (!property) return { ok: false, error: "Property not found." };

  // Form leads never carry a duration.
  const callDurationSeconds =
    data.type === "call" ? data.callDurationSeconds : null;

  const evalProperty: EvaluateLeadProperty = {
    billingType: property.billingType,
    perLeadCallRate: property.perLeadCallRate,
    perLeadFormRate: property.perLeadFormRate,
    estimatedCallValue: property.estimatedCallValue,
    estimatedFormValue: property.estimatedFormValue,
    billableThresholdSeconds: property.billableThresholdSeconds,
  };

  const decision = evaluateLead(
    { type: data.type, callDurationSeconds },
    evalProperty,
  );

  const tz = await getOrgTimezone();
  const occurredAt = data.occurredAt
    ? fromZonedTime(data.occurredAt, tz)
    : new Date();

  await db.insert(leads).values({
    propertyId: property.id,
    // Snapshot the property's current client at creation time.
    clientId: property.clientId,
    type: data.type,
    source: data.source,
    callerName: data.callerName,
    callerPhone: normalizePhone(data.callerPhone),
    callerEmail: data.callerEmail,
    message: data.message,
    callDurationSeconds,
    billableStatus: decision.billableStatus,
    billableReason: decision.billableReason,
    qualifiedBy: decision.qualifiedBy,
    billedAmount: decision.billedAmount,
    estimatedValue: decision.estimatedValue,
    deliveryStatus: "new",
    sourceSystem: "manual",
    occurredAt,
  });

  revalidatePath("/leads");
  revalidatePath("/");
  revalidatePath(`/properties/${property.id}`);
  return { ok: true, message: "Lead added." };
}

const overrideSchema = z.object({
  billableStatus: z.enum(billableStatusEnum.enumValues),
  reason: z.string().trim().min(1, "A short reason is required."),
});

/**
 * Manual override of a lead's billable status. Sets qualified_by = 'manual'
 * (which no automated rule may later overwrite) and re-derives billed_amount
 * and estimated_value from the property's current rates: value is booked only
 * when the new status is 'billable' (rule 3).
 */
export async function overrideLeadBillableStatus(
  leadId: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(leadId).success) {
    return { ok: false, error: "Invalid lead id." };
  }
  const parsed = overrideSchema.safeParse({
    billableStatus: formData.get("billableStatus"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }
  const { billableStatus, reason } = parsed.data;

  const [lead] = await db
    .select({
      id: leads.id,
      type: leads.type,
      propertyId: leads.propertyId,
      billingType: properties.billingType,
      perLeadCallRate: properties.perLeadCallRate,
      perLeadFormRate: properties.perLeadFormRate,
      estimatedCallValue: properties.estimatedCallValue,
      estimatedFormValue: properties.estimatedFormValue,
    })
    .from(leads)
    .innerJoin(properties, eq(properties.id, leads.propertyId))
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead) return { ok: false, error: "Lead not found." };

  const chargesPerLead =
    lead.billingType === "per_lead" || lead.billingType === "hybrid";

  let billedAmount = "0.00";
  let estimatedValue = "0.00";
  if (billableStatus === "billable") {
    if (lead.type === "call") {
      billedAmount = chargesPerLead
        ? toMoneyString(lead.perLeadCallRate)
        : "0.00";
      estimatedValue = toMoneyString(lead.estimatedCallValue);
    } else {
      billedAmount = chargesPerLead
        ? toMoneyString(lead.perLeadFormRate)
        : "0.00";
      estimatedValue = toMoneyString(lead.estimatedFormValue);
    }
  }

  await db
    .update(leads)
    .set({
      billableStatus,
      billableReason: reason,
      qualifiedBy: "manual",
      billedAmount,
      estimatedValue,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));

  revalidatePath("/leads");
  revalidatePath("/");
  revalidatePath(`/properties/${lead.propertyId}`);
  return { ok: true, message: "Lead updated." };
}
