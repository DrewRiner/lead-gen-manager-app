"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const settingsSchema = z.object({
  orgTimezone: z
    .string()
    .trim()
    .min(1, "Timezone is required.")
    .refine(isValidTimeZone, { message: "Invalid IANA timezone." }),
  defaultBillableThresholdSeconds: z
    .string()
    .trim()
    .transform((v) => Math.round(Number(v)))
    .refine((n) => Number.isFinite(n) && n >= 0, {
      message: "Threshold must be a non-negative number.",
    }),
  spamScoreThreshold: z
    .string()
    .trim()
    .transform((v) => Math.round(Number(v)))
    .refine((n) => Number.isFinite(n) && n >= 1, {
      message: "Spam threshold must be a positive number.",
    }),
});

export async function updateSettings(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse({
    orgTimezone: formData.get("orgTimezone"),
    defaultBillableThresholdSeconds: formData.get(
      "defaultBillableThresholdSeconds",
    ),
    spamScoreThreshold: formData.get("spamScoreThreshold"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input.",
    };
  }
  const { orgTimezone, defaultBillableThresholdSeconds, spamScoreThreshold } =
    parsed.data;

  await db
    .insert(appSettings)
    .values({
      id: 1,
      orgTimezone,
      defaultBillableThresholdSeconds,
      spamScoreThreshold,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: {
        orgTimezone,
        defaultBillableThresholdSeconds,
        spamScoreThreshold,
        updatedAt: new Date(),
      },
    });

  // Timezone/threshold changes affect every date-bucketed view.
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}
