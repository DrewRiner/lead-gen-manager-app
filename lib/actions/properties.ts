"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  billingTypeEnum,
  leads,
  properties,
  propertyStatusEnum,
} from "@/lib/db/schema";
import { normalizePhone } from "@/lib/phone";
import { toMoneyString } from "@/lib/money";

export type ActionResult =
  | { ok: true; message?: string; count?: number }
  | { ok: false; error: string };

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

const money = z
  .string()
  .trim()
  .optional()
  .transform((v) => toMoneyString(v && v.length > 0 ? v : 0));

const nonNegInt = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : 60;
  });

const clientIdField = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))
  .refine((v) => v === null || z.string().uuid().safeParse(v).success, {
    message: "Invalid client.",
  });

const propertySchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  displayName: optionalText,
  domain: optionalText,
  niche: optionalText,
  city: optionalText,
  state: optionalText,
  status: z.enum(propertyStatusEnum.enumValues),
  gbpPlaceId: optionalText,
  trackingPhone: optionalText,
  clientId: clientIdField,
  billingType: z.enum(billingTypeEnum.enumValues),
  monthlyRate: money,
  perLeadCallRate: money,
  perLeadFormRate: money,
  estimatedCallValue: money,
  estimatedFormValue: money,
  billableThresholdSeconds: nonNegInt,
  notes: optionalText,
});

function parseForm(formData: FormData) {
  return propertySchema.safeParse({
    name: formData.get("name"),
    displayName: formData.get("displayName"),
    domain: formData.get("domain"),
    niche: formData.get("niche"),
    city: formData.get("city"),
    state: formData.get("state"),
    status: formData.get("status"),
    gbpPlaceId: formData.get("gbpPlaceId"),
    trackingPhone: formData.get("trackingPhone"),
    clientId: formData.get("clientId"),
    billingType: formData.get("billingType"),
    monthlyRate: formData.get("monthlyRate"),
    perLeadCallRate: formData.get("perLeadCallRate"),
    perLeadFormRate: formData.get("perLeadFormRate"),
    estimatedCallValue: formData.get("estimatedCallValue"),
    estimatedFormValue: formData.get("estimatedFormValue"),
    billableThresholdSeconds: formData.get("billableThresholdSeconds"),
    notes: formData.get("notes"),
  });
}

export async function createProperty(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  await db.insert(properties).values({
    ...data,
    trackingPhone: normalizePhone(data.trackingPhone),
  });
  revalidatePath("/properties");
  return { ok: true, message: "Property created." };
}

export async function updateProperty(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid property id." };
  }
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  await db
    .update(properties)
    .set({
      ...data,
      trackingPhone: normalizePhone(data.trackingPhone),
      updatedAt: new Date(),
    })
    .where(eq(properties.id, id));
  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
  return { ok: true, message: "Property updated." };
}

export async function softDeleteProperty(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid property id." };
  }
  await db
    .update(properties)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(properties.id, id), isNull(properties.deletedAt)));
  revalidatePath("/properties");
  return { ok: true, message: "Property deleted." };
}

/**
 * Re-run the property's CURRENT estimated rates across all its historical
 * (non-deleted) leads. This is the ONLY path that mutates historical
 * estimated_value. billed_amount (the billing snapshot) is never touched, and
 * only billable leads receive value (rule 3).
 */
export async function recalcEstimatedValues(
  id: string,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid property id." };
  }

  const [property] = await db
    .select({
      estimatedCallValue: properties.estimatedCallValue,
      estimatedFormValue: properties.estimatedFormValue,
    })
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1);

  if (!property) return { ok: false, error: "Property not found." };

  const callValue = toMoneyString(property.estimatedCallValue);
  const formValue = toMoneyString(property.estimatedFormValue);

  const updated = await db
    .update(leads)
    .set({
      estimatedValue: sql`case
        when ${leads.billableStatus} = 'billable' and ${leads.type} = 'call' then ${callValue}::numeric(10,2)
        when ${leads.billableStatus} = 'billable' and ${leads.type} = 'form' then ${formValue}::numeric(10,2)
        else 0
      end`,
      updatedAt: new Date(),
    })
    .where(and(eq(leads.propertyId, id), isNull(leads.deletedAt)))
    .returning({ id: leads.id });

  revalidatePath(`/properties/${id}`);
  revalidatePath("/properties");
  revalidatePath("/reports");
  revalidatePath("/");
  return {
    ok: true,
    message: `Recalculated estimated values for ${updated.length} lead${updated.length === 1 ? "" : "s"}.`,
    count: updated.length,
  };
}
