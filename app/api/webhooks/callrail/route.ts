import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";
import {
  PROVIDER,
  callRailEventType,
  normalizeCallRail,
} from "@/lib/ingestion/adapters/callrail";
import { ingestCanonicalLead } from "@/lib/ingestion/ingest";
import {
  headersToObject,
  secretMatches,
  signatureVerificationEnabled,
} from "@/lib/ingestion/webhook-auth";

// The CallRail call-ingestion endpoint. Same pipeline as GHL forms: log the raw
// event FIRST, verify the signature, normalize, resolve, upsert. It must never
// 5xx on an unresolvable call (CallRail retries), so past logging we always 200.
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
      eventType: parseError || parsed == null ? "call" : callRailEventType(parsed),
      rawPayload: (parseError || parsed == null
        ? { _raw: rawText, _parseError: parseError }
        : parsed) as typeof webhookEvents.$inferInsert.rawPayload,
      headers,
      authValid: false,
    })
    .returning({ id: webhookEvents.id });
  const eventId = event.id;

  // -- 2. Authenticate via the ?secret= URL query param -----------------------
  // CallRail on our plan can't sign request headers (that's a higher tier), so
  // we authenticate with a shared secret on the webhook URL itself, compared
  // constant-time against CALLRAIL_WEBHOOK_SECRET. The raw event is already
  // logged above, so a rejected request still leaves a trace.
  const verify = signatureVerificationEnabled();
  const provided = new URL(req.url).searchParams.get("secret");
  const secret = process.env.CALLRAIL_WEBHOOK_SECRET ?? null;
  const authValid = verify ? secretMatches(provided, secret) : true;

  await db
    .update(webhookEvents)
    .set({ authValid })
    .where(eq(webhookEvents.id, eventId));

  if (verify && !authValid) {
    await db
      .update(webhookEvents)
      .set({ error: secret ? "invalid_secret" : "no_secret_configured" })
      .where(eq(webhookEvents.id, eventId));
    return NextResponse.json(
      { ok: false, error: "invalid_secret" },
      { status: 401 },
    );
  }

  // -- 3. Malformed body: logged above; ack 200 so CallRail stops retrying ----
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

  // -- 4. Normalize -> resolve -> upsert (merge on call_modified). No 5xx -----
  try {
    const canonical = normalizeCallRail(parsed);
    const result = await ingestCanonicalLead(canonical, eventId);
    return NextResponse.json(
      {
        ok: true,
        leadId: result.leadId,
        matched: result.matched,
        matchStrategy: result.matchStrategy,
        merged: result.duplicate,
      },
      { status: 200 },
    );
  } catch (err) {
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

export async function GET(): Promise<Response> {
  return NextResponse.json(
    { ok: true, endpoint: "callrail", method: "POST" },
    { status: 200 },
  );
}
