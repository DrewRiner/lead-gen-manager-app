"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  billingTypeEnum,
  clients,
  properties,
  propertyAssignments,
} from "@/lib/db/schema";
import { previousDateStr, todayDateStr } from "@/lib/dates";
import { toMoneyString } from "@/lib/money";
import { getOrgTimezone } from "@/lib/settings";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

function revalidateAll(propertyId: string, clientId?: string | null) {
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/clients");
  if (clientId) revalidatePath(`/clients/${clientId}`);
  revalidatePath("/reports");
  revalidatePath("/");
}

/**
 * Assign (or reassign) a client to a property. Creates a new active assignment
 * snapshotting the property's CURRENT rates, ends any existing active
 * assignment, and sets properties.client_id — all in one transaction. This and
 * unassignClient are the only ways properties.client_id ever changes.
 */
export async function assignClient(
  propertyId: string,
  clientId: string,
): Promise<ActionResult> {
  if (
    !z.string().uuid().safeParse(propertyId).success ||
    !z.string().uuid().safeParse(clientId).success
  ) {
    return { ok: false, error: "Invalid property or client id." };
  }

  const tz = await getOrgTimezone();
  const today = todayDateStr(tz);

  try {
    await db.transaction(async (tx) => {
      const [property] = await tx
        .select()
        .from(properties)
        .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)))
        .limit(1);
      if (!property) throw new Error("Property not found.");

      const [client] = await tx
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
        .limit(1);
      if (!client) throw new Error("Client not found.");

      // No-op if this client is already the active one.
      if (property.clientId === clientId) return;

      // End any currently-active assignment (reassignment / handoff).
      await tx
        .update(propertyAssignments)
        .set({ endedOn: today, updatedAt: new Date() })
        .where(
          and(
            eq(propertyAssignments.propertyId, propertyId),
            isNull(propertyAssignments.endedOn),
          ),
        );

      // Create the new active assignment, snapshotting current property rates.
      await tx.insert(propertyAssignments).values({
        propertyId,
        clientId,
        startedOn: today,
        endedOn: null,
        billingType: property.billingType,
        monthlyRate: property.monthlyRate,
        perLeadCallRate: property.perLeadCallRate,
        perLeadFormRate: property.perLeadFormRate,
      });

      // Keep properties.client_id and status in lockstep with the assignment.
      await tx
        .update(properties)
        .set({ clientId, status: "rented", updatedAt: new Date() })
        .where(eq(properties.id, propertyId));
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not assign client.",
    };
  }

  revalidateAll(propertyId, clientId);
  return { ok: true, message: "Client assigned." };
}

const money = z
  .string()
  .trim()
  .optional()
  .transform((v) => toMoneyString(v && v.length > 0 ? v : 0));

const changeRateSchema = z.object({
  effectiveDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an effective date."),
  billingType: z.enum(billingTypeEnum.enumValues),
  monthlyRate: money,
  perLeadCallRate: money,
  perLeadFormRate: money,
});

/**
 * Reprice the ACTIVE assignment from an effective date forward, keeping history
 * intact: end the current assignment the day before the effective date and
 * start a new one for the SAME client with the new snapshotted rates. This is
 * the explicit, non-silent way to change what the current client pays.
 */
export async function changeActiveRate(
  propertyId: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(propertyId).success) {
    return { ok: false, error: "Invalid property id." };
  }
  const parsed = changeRateSchema.safeParse({
    effectiveDate: formData.get("effectiveDate"),
    billingType: formData.get("billingType"),
    monthlyRate: formData.get("monthlyRate"),
    perLeadCallRate: formData.get("perLeadCallRate"),
    perLeadFormRate: formData.get("perLeadFormRate"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input.",
    };
  }
  const data = parsed.data;
  const dayBefore = previousDateStr(data.effectiveDate);

  let clientId: string | null = null;
  try {
    await db.transaction(async (tx) => {
      const [active] = await tx
        .select()
        .from(propertyAssignments)
        .where(
          and(
            eq(propertyAssignments.propertyId, propertyId),
            isNull(propertyAssignments.endedOn),
          ),
        )
        .limit(1);
      if (!active) throw new Error("No active assignment to reprice.");

      // Effective date must fall after the current assignment started, so the
      // ended-day-before is not earlier than its start.
      if (data.effectiveDate <= active.startedOn) {
        throw new Error(
          "Effective date must be after the current assignment started.",
        );
      }
      clientId = active.clientId;

      await tx
        .update(propertyAssignments)
        .set({ endedOn: dayBefore, updatedAt: new Date() })
        .where(eq(propertyAssignments.id, active.id));

      await tx.insert(propertyAssignments).values({
        propertyId,
        clientId: active.clientId,
        startedOn: data.effectiveDate,
        endedOn: null,
        billingType: data.billingType,
        monthlyRate: data.monthlyRate,
        perLeadCallRate: data.perLeadCallRate,
        perLeadFormRate: data.perLeadFormRate,
      });
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not change rate.",
    };
  }

  revalidateAll(propertyId, clientId);
  return { ok: true, message: "Rate changed for the current client." };
}

/**
 * Unassign the current client: end the active assignment and null
 * properties.client_id, in one transaction.
 */
export async function unassignClient(
  propertyId: string,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(propertyId).success) {
    return { ok: false, error: "Invalid property id." };
  }

  const tz = await getOrgTimezone();
  const today = todayDateStr(tz);

  try {
    await db.transaction(async (tx) => {
      const [property] = await tx
        .select({ id: properties.id, clientId: properties.clientId })
        .from(properties)
        .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)))
        .limit(1);
      if (!property) throw new Error("Property not found.");

      await tx
        .update(propertyAssignments)
        .set({ endedOn: today, updatedAt: new Date() })
        .where(
          and(
            eq(propertyAssignments.propertyId, propertyId),
            isNull(propertyAssignments.endedOn),
          ),
        );

      // Unassigning returns the property to producing (sellable inventory).
      await tx
        .update(properties)
        .set({ clientId: null, status: "producing", updatedAt: new Date() })
        .where(eq(properties.id, propertyId));
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not unassign client.",
    };
  }

  revalidateAll(propertyId);
  return { ok: true, message: "Client unassigned." };
}
