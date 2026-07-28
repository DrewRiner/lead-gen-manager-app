"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { appSettings, webhookEvents } from "@/lib/db/schema";
import { normalizeGhlForm } from "@/lib/ingestion/adapters/ghl-form";
import { ingestCanonicalLead } from "@/lib/ingestion/ingest";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

/**
 * Rotate the inbound-webhook shared secret. Existing GHL configs immediately
 * stop authenticating until the new value is pasted into them, so the UI warns
 * before calling this.
 */
export async function regenerateWebhookSecret(): Promise<ActionResult> {
  const secret = randomBytes(32).toString("hex"); // 64 hex chars
  await db
    .insert(appSettings)
    .values({ id: 1, webhookSecret: secret, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { webhookSecret: secret, updatedAt: new Date() },
    });
  revalidatePath("/settings");
  return { ok: true, message: "Webhook secret regenerated." };
}

/**
 * Re-run ingestion for a previously-logged webhook event using its stored raw
 * payload. Idempotent: a lead already created for this submission is re-linked,
 * not duplicated. Useful after fixing a property's Lead Source / form id.
 */
export async function replayWebhookEvent(
  eventId: string,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(eventId).success) {
    return { ok: false, error: "Invalid event id." };
  }

  const [event] = await db
    .select({
      id: webhookEvents.id,
      provider: webhookEvents.provider,
      rawPayload: webhookEvents.rawPayload,
    })
    .from(webhookEvents)
    .where(eq(webhookEvents.id, eventId))
    .limit(1);
  if (!event) return { ok: false, error: "Event not found." };

  const payload = event.rawPayload as Record<string, unknown> | null;
  if (!payload || payload._parseError === true) {
    return {
      ok: false,
      error: "This event's body was never valid JSON — nothing to replay.",
    };
  }
  if (event.provider !== "ghl") {
    return { ok: false, error: `No adapter for provider "${event.provider}".` };
  }

  try {
    const canonical = normalizeGhlForm(payload);
    const result = await ingestCanonicalLead(canonical, eventId);
    revalidatePath("/settings");
    revalidatePath("/leads");
    revalidatePath("/");
    const how = result.matched
      ? `matched by ${result.matchStrategy}`
      : "unmatched";
    return {
      ok: true,
      message: result.duplicate
        ? `Replayed — already ingested (${how}).`
        : `Replayed — lead created (${how}).`,
    };
  } catch (err) {
    return { ok: false, error: `Replay failed: ${(err as Error).message}` };
  }
}
