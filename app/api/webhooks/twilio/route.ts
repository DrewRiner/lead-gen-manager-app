import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";
import {
  PROVIDER,
  normalizeTwilio,
  twilioEventType,
} from "@/lib/ingestion/adapters/twilio";
import { ingestCanonicalLead } from "@/lib/ingestion/ingest";
import {
  TWILIO_SIGNATURE_HEADER,
  headersToObject,
  signatureVerificationEnabled,
  twilioSignatureValid,
} from "@/lib/ingestion/webhook-auth";

// The Twilio voice call-status ingestion endpoint. Same pipeline as GHL forms
// and CallRail: log the raw event FIRST, verify the signature, normalize,
// resolve, upsert. It must never 5xx on an unresolvable call, so past logging
// we always return 200 — with valid (empty) TwiML, which is what Twilio expects.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A minimal, valid empty TwiML document. Twilio wants XML back from a webhook;
// an empty <Response/> tells it to take no further action.
const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
function twiml(status = 200): Response {
  return new Response(EMPTY_TWIML, {
    status,
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

/**
 * Rebuild the exact public URL Twilio signed against. Twilio computes its
 * signature over the URL it was configured with (the public https origin), not
 * the internal URL Vercel hands the function — so we reconstruct it from the
 * forwarded proto/host plus this request's path and query string.
 */
function publicUrl(req: Request): string {
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? u.host;
  const proto =
    req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${u.pathname}${u.search}`;
}

export async function POST(req: Request): Promise<Response> {
  // -- 1. Log the raw request BEFORE parsing or authenticating ----------------
  // Twilio posts application/x-www-form-urlencoded, not JSON.
  const rawText = await req.text();
  const headers = headersToObject(req.headers);

  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(rawText)) params[k] = v;
  const hasParams = Object.keys(params).length > 0;

  const [event] = await db
    .insert(webhookEvents)
    .values({
      provider: PROVIDER,
      eventType: hasParams ? twilioEventType(params) : "call",
      rawPayload: (hasParams
        ? params
        : { _raw: rawText }) as typeof webhookEvents.$inferInsert.rawPayload,
      headers,
      authValid: false,
    })
    .returning({ id: webhookEvents.id });
  const eventId = event.id;

  // -- 2. Verify Twilio's X-Twilio-Signature (HMAC-SHA1, proper signing) ------
  const verify = signatureVerificationEnabled();
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? null;
  const provided = req.headers.get(TWILIO_SIGNATURE_HEADER);
  const authValid = verify
    ? twilioSignatureValid(publicUrl(req), params, provided, authToken)
    : true;

  await db.update(webhookEvents).set({ authValid }).where(eq(webhookEvents.id, eventId));

  if (verify && !authValid) {
    await db
      .update(webhookEvents)
      .set({ error: authToken ? "invalid_signature" : "no_auth_token_configured" })
      .where(eq(webhookEvents.id, eventId));
    // 403 for a bad signature — but with TwiML so Twilio logs it cleanly.
    return twiml(403);
  }

  // -- 3. Empty/parseless body: logged above; ack 200 so Twilio doesn't retry -
  if (!hasParams) {
    await db
      .update(webhookEvents)
      .set({ error: "empty_body" })
      .where(eq(webhookEvents.id, eventId));
    return twiml(200);
  }

  // -- 4. Normalize -> resolve -> upsert (idempotent on CallSid). No 5xx ------
  try {
    const canonical = normalizeTwilio(params);
    await ingestCanonicalLead(canonical, eventId);
    return twiml(200);
  } catch (err) {
    await db
      .update(webhookEvents)
      .set({ error: `ingest_failed: ${(err as Error).message}`.slice(0, 500) })
      .where(eq(webhookEvents.id, eventId));
    return twiml(200);
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json(
    { ok: true, endpoint: "twilio", method: "POST" },
    { status: 200 },
  );
}
