import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { appSettings, webhookEvents } from "@/lib/db/schema";
import { PROVIDER, normalizeGhlForm } from "@/lib/ingestion/adapters/ghl-form";
import { ingestCanonicalLead } from "@/lib/ingestion/ingest";
import {
  WEBHOOK_SECRET_HEADER,
  headersToObject,
  secretMatches,
} from "@/lib/ingestion/webhook-auth";

// This is the ONLY HTTP endpoint in the app — every other mutation is a Server
// Action. It must never 5xx on an unresolvable or malformed lead: GoHighLevel
// retries failed webhooks indefinitely, so once we've durably logged the raw
// event we always answer 200 (except a genuine auth failure, which is 401 so
// the operator notices the misconfiguration).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  // -- 1. Log the raw request BEFORE parsing or authenticating ---------------
  const rawText = await req.text();
  const headers = headersToObject(req.headers);

  let parsed: unknown = null;
  let parseError = false;
  try {
    parsed = rawText.length > 0 ? JSON.parse(rawText) : null;
  } catch {
    parseError = true;
  }

  const [event] = await db
    .insert(webhookEvents)
    .values({
      provider: PROVIDER,
      eventType: "form",
      // Store the parsed JSON when we have it; otherwise keep the raw text so
      // nothing is lost and the event stays replayable.
      rawPayload: (parseError || parsed == null
        ? { _raw: rawText, _parseError: parseError }
        : parsed) as typeof webhookEvents.$inferInsert.rawPayload,
      headers,
      authValid: false,
    })
    .returning({ id: webhookEvents.id });

  const eventId = event.id;

  // -- 2. Verify the shared secret (constant-time), record the result --------
  const provided = req.headers.get(WEBHOOK_SECRET_HEADER);
  const [settings] = await db
    .select({ secret: appSettings.webhookSecret })
    .from(appSettings)
    .where(eq(appSettings.id, 1))
    .limit(1);

  const authValid = secretMatches(provided, settings?.secret);
  await db
    .update(webhookEvents)
    .set({ authValid })
    .where(eq(webhookEvents.id, eventId));

  if (!authValid) {
    await db
      .update(webhookEvents)
      .set({
        error: settings?.secret ? "invalid_secret" : "no_secret_configured",
      })
      .where(eq(webhookEvents.id, eventId));
    return NextResponse.json(
      { ok: false, error: "invalid_secret" },
      { status: 401 },
    );
  }

  // -- 3. Malformed body: logged above; ack 200 so GHL stops retrying --------
  if (parseError) {
    await db
      .update(webhookEvents)
      .set({ error: "malformed_json" })
      .where(eq(webhookEvents.id, eventId));
    return NextResponse.json(
      { ok: false, error: "malformed_json", logged: true },
      { status: 200 },
    );
  }

  // -- 4. Normalize -> resolve -> upsert. Never 5xx past this point ----------
  try {
    const canonical = normalizeGhlForm(parsed);
    const result = await ingestCanonicalLead(canonical, eventId);
    return NextResponse.json(
      {
        ok: true,
        leadId: result.leadId,
        matched: result.matched,
        matchStrategy: result.matchStrategy,
        duplicate: result.duplicate,
      },
      { status: 200 },
    );
  } catch (err) {
    // Downstream failure: the raw event is already persisted and replayable.
    await db
      .update(webhookEvents)
      .set({ error: `ingest_failed: ${(err as Error).message}`.slice(0, 500) })
      .where(eq(webhookEvents.id, eventId));
    return NextResponse.json(
      { ok: false, error: "ingest_failed", logged: true },
      { status: 200 },
    );
  }
}

// A bare GET is handy for a quick liveness check and to discourage treating
// this as a browser page. It never processes anything.
export async function GET(): Promise<Response> {
  return NextResponse.json(
    { ok: true, endpoint: "ghl-form", method: "POST" },
    { status: 200 },
  );
}
