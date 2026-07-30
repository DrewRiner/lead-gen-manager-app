"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  clients,
  clientStatusEnum,
  properties,
  propertyAssignments,
} from "@/lib/db/schema";
import { normalizePhone } from "@/lib/phone";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

const clientSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required."),
  contactName: optionalText,
  email: optionalText.refine(
    (v) => v === null || z.string().email().safeParse(v).success,
    { message: "Enter a valid email." },
  ),
  phone: optionalText,
  status: z.enum(clientStatusEnum.enumValues),
  notes: optionalText,
});

function parseForm(formData: FormData) {
  return clientSchema.safeParse({
    businessName: formData.get("businessName"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });
}

export async function createClient(formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  await db.insert(clients).values({
    ...data,
    phone: normalizePhone(data.phone),
  });
  revalidatePath("/clients");
  return { ok: true, message: "Client created." };
}

export async function updateClient(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid client id." };
  }
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  await db
    .update(clients)
    .set({ ...data, phone: normalizePhone(data.phone), updatedAt: new Date() })
    .where(eq(clients.id, id));
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true, message: "Client updated." };
}

export async function softDeleteClient(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid client id." };
  }

  // Guard: a client holding any active assignment cannot be deleted — unassign
  // (or end the trial) first. Naming the properties makes the fix obvious.
  const active = await db
    .select({ name: properties.name })
    .from(propertyAssignments)
    .innerJoin(properties, eq(properties.id, propertyAssignments.propertyId))
    .where(
      and(
        eq(propertyAssignments.clientId, id),
        isNull(propertyAssignments.endedOn),
      ),
    );
  if (active.length > 0) {
    const names = active.map((p) => p.name).join(", ");
    return {
      ok: false,
      error: `Unassign this client from ${names} before deleting. Historical revenue is preserved.`,
    };
  }

  await db
    .update(clients)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(clients.id, id), isNull(clients.deletedAt)));
  revalidatePath("/clients");
  return { ok: true, message: "Client deleted." };
}

/** Restore a soft-deleted client — back into lists and pickers. */
export async function restoreClient(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid client id." };
  }
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, id), isNotNull(clients.deletedAt)))
    .limit(1);
  if (!client) return { ok: false, error: "Client not found or not deleted." };

  await db
    .update(clients)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(clients.id, id));
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true, message: "Client restored." };
}
