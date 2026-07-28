"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { clients, clientStatusEnum } from "@/lib/db/schema";
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
  await db
    .update(clients)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(clients.id, id), isNull(clients.deletedAt)));
  revalidatePath("/clients");
  return { ok: true, message: "Client deleted." };
}
