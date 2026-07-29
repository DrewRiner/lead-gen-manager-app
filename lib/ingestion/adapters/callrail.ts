import { normalizePhone } from "@/lib/phone";
import type { LeadSource } from "@/lib/billing/evaluate-lead";
import type { CanonicalLead } from "@/lib/ingestion/types";

// ---------------------------------------------------------------------------
// CallRail call-ingestion adapter. Provider #2 — same normalize(payload) ->
// CanonicalLead contract as the GHL form adapter, so nothing downstream changes.
//
// TWO webhooks, ONE lead:
//   • post_call    — fires at hangup with the full call object.
//   • call_modified — fires later (up to ~20 min) with the same call object plus
//     later fields (recording_duration, transcription_text, tags, …).
// Both carry the SAME CallRail `id`, so both normalize to the same externalId
// (source_system='callrail', external_id=id). post_call inserts the lead;
// call_modified MERGES its later fields (recording, transcript, answered) into
// that SAME lead in ingest.ts — it never creates a duplicate.
//
// Field names confirmed against CallRail's API attribute list + webhook docs:
//   id, tracking_phone_number (dialed — the ROUTING key), customer_phone_number
//   (caller — display only, NEVER routed), business_phone_number, duration,
//   answered, first_call (true => first-time caller), recording (URL),
//   recording_duration, transcription_text / transcription, tags, customer_name,
//   start_time.
// ---------------------------------------------------------------------------

export const PROVIDER = "callrail";

type Json = Record<string, unknown>;

function asObject(v: unknown): Json {
  return v != null && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
}

/** First non-empty string among top-level keys. */
function str(p: Json, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = p[k];
    if (typeof v === "number") return String(v);
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length > 0) return t;
    }
  }
  return null;
}

function num(p: Json, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = p[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
      return Number(v);
    }
  }
  return null;
}

function bool(p: Json, key: string): boolean | null {
  const v = p[key];
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

/** CallRail "source" hint -> our LeadSource. Calls default to 'other'. */
function mapSource(source: string | null): LeadSource {
  if (!source) return "other";
  const s = source.toLowerCase();
  if (s.includes("google") && s.includes("organic")) return "organic";
  if (s.includes("google business") || s.includes("gmb") || s.includes("maps")) return "gbp";
  if (s.includes("direct")) return "direct";
  if (s.includes("organic")) return "organic";
  return "other";
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Normalize a CallRail webhook payload (post_call OR call_modified) into a
 * CanonicalLead of type 'call'. Never throws on shape.
 *
 * @param now Receipt time; fallback when the payload has no start_time.
 */
export function normalizeCallRail(payload: unknown, now: Date = new Date()): CanonicalLead {
  const p = asObject(payload);

  const callId = str(p, "id", "call_id");
  const tracking = normalizePhone(str(p, "tracking_phone_number"));
  const caller = normalizePhone(str(p, "customer_phone_number", "caller_number"));
  const durationRaw = num(p, "duration");
  const firstCall = bool(p, "first_call");

  const parsedStart = parseDate(str(p, "start_time", "created_at", "start_time_iso8601"));
  const occurredAt = parsedStart ?? now;
  const occurredAtFallback = parsedStart == null;

  return {
    provider: PROVIDER,
    // No CallRail id (shouldn't happen) => synthesize from tracking+time so a
    // replay still de-dupes deterministically.
    externalId: callId ?? `callrail_${tracking ?? "unknown"}_${occurredAt.toISOString()}`,
    type: "call",
    source: mapSource(str(p, "source", "lead_source", "utm_source")),

    // Resolution: calls route ONLY by the dialed tracking number.
    leadSourceRaw: null,
    ghlFormId: null,
    pageUrl: null,
    trackingPhone: tracking,

    // Call fields.
    callDurationSeconds: durationRaw != null ? Math.round(durationRaw) : null,
    callAnswered: bool(p, "answered"),
    isRepeatCaller: firstCall == null ? null : !firstCall,
    recordingUrl: str(p, "recording", "recording_url"),
    transcript: str(p, "transcription_text", "transcription"),
    callrailCallId: callId,

    // Contact / content.
    fullName: str(p, "customer_name"),
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

    rawPayload: payload,
  };
}

/** Best-effort event label for the webhook_events log (post_call vs call_modified). */
export function callRailEventType(payload: unknown): string {
  const p = asObject(payload);
  const modified =
    "transcription_text" in p || "recording_duration" in p || "tags" in p;
  return modified ? "call_modified" : "post_call";
}
