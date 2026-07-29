import { normalizePhone } from "@/lib/phone";
import type { CanonicalLead } from "@/lib/ingestion/types";

// ---------------------------------------------------------------------------
// Twilio call-ingestion adapter. Provider #3 — same normalize(params) ->
// CanonicalLead contract as CallRail, so nothing downstream changes.
//
// Twilio posts the VOICE CALL STATUS CALLBACK as application/x-www-form-
// urlencoded (NOT JSON). The route parses the body into a flat string map and
// hands it here. Field names confirmed against Twilio's Voice webhook docs:
//   CallSid        — unique call id (de-dupe key; parallel to callrail's id)
//   To             — the DIALED number (the routing key; E.164)
//   From           — the caller (display only, NEVER routed)
//   CallStatus     — queued|ringing|in-progress|completed|busy|failed|
//                    no-answer|canceled. 'completed' => answered; the terminal
//                    non-completed states => missed.
//   CallDuration   — length of the just-completed call, in seconds
//   RecordingUrl   — recording audio URL, when recording is enabled
//   Timestamp      — RFC-2822 event time (not always present on status cbs)
//
// Unlike CallRail there is no transcript, no "first call" flag, and no source
// hint, so those map to null / 'other'. type='call', source_system='twilio'.
// ---------------------------------------------------------------------------

export const PROVIDER = "twilio";

type Params = Record<string, string>;

/** First non-empty, trimmed string among the given keys. */
function str(p: Params, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = p[k];
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length > 0) return t;
    }
  }
  return null;
}

function num(p: Params, ...keys: string[]): number | null {
  const raw = str(p, ...keys);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Answered vs missed from CallStatus:
 *   completed                        -> answered (true)
 *   no-answer | busy | failed | canceled -> missed (false)
 *   anything else (in-progress, etc.) -> unknown (null)
 */
function answeredFromStatus(status: string | null): boolean | null {
  if (!status) return null;
  const s = status.trim().toLowerCase();
  if (s === "completed") return true;
  if (s === "no-answer" || s === "busy" || s === "failed" || s === "canceled") {
    return false;
  }
  return null;
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw); // Date parses RFC-2822 ("Wed, 29 Jul 2026 18:39:06 +0000").
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Normalize a Twilio voice status-callback param map into a CanonicalLead of
 * type 'call'. Never throws on shape.
 *
 * @param params Flat form-decoded params (from `new URLSearchParams(body)`).
 * @param now    Receipt time; the occurred_at fallback when no timestamp given.
 */
export function normalizeTwilio(params: Params, now: Date = new Date()): CanonicalLead {
  const callSid = str(params, "CallSid");
  const tracking = normalizePhone(str(params, "To")); // dialed => routing key
  const caller = normalizePhone(str(params, "From")); // caller => display only
  const durationRaw = num(params, "CallDuration");

  const parsedTime = parseDate(str(params, "Timestamp"));
  const occurredAt = parsedTime ?? now;
  const occurredAtFallback = parsedTime == null;

  return {
    provider: PROVIDER,
    // No CallSid (shouldn't happen) => synthesize from To+time so a replay still
    // de-dupes deterministically.
    externalId: callSid ?? `twilio_${tracking ?? "unknown"}_${occurredAt.toISOString()}`,
    type: "call",
    // Twilio's callback carries no marketing-source hint.
    source: "other",

    // Resolution: calls route ONLY by the dialed tracking number (To).
    leadSourceRaw: null,
    ghlFormId: null,
    pageUrl: null,
    trackingPhone: tracking,

    // Call fields.
    callDurationSeconds: durationRaw != null ? Math.round(durationRaw) : null,
    callAnswered: answeredFromStatus(str(params, "CallStatus")),
    // Twilio doesn't tell us whether this is a first-time caller.
    isRepeatCaller: null,
    recordingUrl: str(params, "RecordingUrl"),
    transcript: null,
    callrailCallId: null,
    twilioCallSid: callSid,

    // Contact / content.
    fullName: null,
    phone: caller,
    email: null,
    message: null,
    formName: null,
    ghlContactId: null,
    ghlLocationId: null,
    ip: null,
    formAnswers: null,

    occurredAt,
    occurredAtFallback,
    occurredAtNote: occurredAtFallback ? "occurred_at defaulted to receipt time" : null,

    rawPayload: params,
  };
}

/** Event label for the webhook_events log — the CallStatus, or 'call'. */
export function twilioEventType(params: Params): string {
  return str(params, "CallStatus") ?? "call";
}
