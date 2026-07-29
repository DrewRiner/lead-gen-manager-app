import { createHash } from "node:crypto";

import type { LeadSource } from "@/lib/billing/evaluate-lead";
import { normalizePhone } from "@/lib/phone";
import type { CanonicalLead } from "@/lib/ingestion/types";

// ---------------------------------------------------------------------------
// GoHighLevel form-submission adapter, written against a REAL captured payload
// (see the fixtures in ghl-form.test.ts). GHL delivers a contact-shaped body:
//
//   contact_source   -> the brand / property (PRIMARY routing key)
//   contact_id       -> stable across submissions from the same person
//   first/last/full_name, email, phone (already E.164), date_created
//   location         -> OUR agency address, never the property (never routed)
//   attributionSource-> { sessionSource, url, mediumId (the GHL form id), ... }
//   customData       -> GHL housekeeping, not form answers
//   <Form Label>: value  -> custom form fields appear as TOP-LEVEL keys, and
//                           differ per property
//
// Anything unrecognized still survives verbatim in rawPayload, and any custom
// form field is swept into formAnswers.
//
// This adapter is provider #1. CallRail / Twilio later add sibling files that
// export the same normalize(payload) -> CanonicalLead signature.
// ---------------------------------------------------------------------------

export const PROVIDER = "ghl";

/** date_created older than this from receipt time is treated as stale. */
const STALE_TIMESTAMP_MS = 10 * 60 * 1000;

const OCCURRED_NOTE_STALE =
  "occurred_at defaulted to receipt time — provider timestamp was stale";
const OCCURRED_NOTE_ABSENT =
  "occurred_at defaulted to receipt time — payload had no timestamp";

type Json = Record<string, unknown>;

// Standard top-level keys that are NOT custom form answers. Everything else at
// the top level is treated as a form field and swept into formAnswers.
const STANDARD_KEYS = new Set<string>([
  "contact_source",
  "contact_id",
  "first_name",
  "last_name",
  "full_name",
  "name",
  "email",
  "phone",
  "date_created",
  "country",
  "timezone",
  "tags",
  "full_address",
  "contact_type",
  "location",
  "workflow",
  "customData",
  "attributionSource",
  "contact",
]);

function asObject(v: unknown): Json {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Json)
    : {};
}

/** First non-empty string among the given dotted paths (e.g. "location.id"). */
function pick(payload: Json, ...paths: string[]): string | null {
  for (const path of paths) {
    let cur: unknown = payload;
    for (const seg of path.split(".")) {
      cur = asObject(cur)[seg];
      if (cur == null) break;
    }
    if (Array.isArray(cur)) cur = cur[0];
    if (typeof cur === "number") cur = String(cur);
    if (typeof cur === "string") {
      const t = cur.trim();
      if (t.length > 0) return t;
    }
  }
  return null;
}

/** Coerce a value to a non-empty trimmed string, or null. */
function asNonEmptyString(v: unknown): string | null {
  if (Array.isArray(v)) v = v[0];
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

/**
 * Sweep every top-level key that isn't a known standard field into an answers
 * object keyed by the form label. Empty-string values are dropped so a
 * mislabeled hidden field doesn't pollute the answers. Returns null when there
 * are no custom fields.
 */
function collectFormAnswers(p: Json): Record<string, string> | null {
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (STANDARD_KEYS.has(k)) continue;
    const val = asNonEmptyString(v);
    if (val == null) continue;
    answers[k] = val;
  }
  return Object.keys(answers).length > 0 ? answers : null;
}

/** Compose "Label: value" lines from form answers for the leads-table message. */
function composeMessage(answers: Record<string, string> | null): string | null {
  if (!answers) return null;
  const lines = Object.entries(answers).map(([label, value]) => `${label}: ${value}`);
  return lines.length > 0 ? lines.join(" / ") : null;
}

/** Parse a timestamp; null when absent/unparseable. */
function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  if (/^\d{10,13}$/.test(raw)) {
    const n = Number(raw);
    const ms = raw.length <= 10 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fullName(payload: Json): string | null {
  const direct = pick(payload, "full_name", "contact.full_name");
  if (direct) return direct;
  const first = pick(payload, "first_name", "contact.first_name");
  const last = pick(payload, "last_name", "contact.last_name");
  const joined = [first, last].filter(Boolean).join(" ").trim();
  return joined.length > 0 ? joined : null;
}

/** attributionSource.sessionSource -> our LeadSource enum. */
function mapSource(sessionSource: string | null): LeadSource {
  if (!sessionSource) return "other";
  const s = sessionSource.toLowerCase();
  if (s === "direct traffic") return "direct";
  if (s.includes("google")) return "organic";
  return "other";
}

/**
 * Stable, order-independent hash of the form answers, so a webhook retry that
 * re-serializes the same answers in a different key order still dedupes.
 */
function answersHash(answers: Record<string, string> | null): string {
  if (!answers) return "";
  const sorted = Object.keys(answers)
    .sort()
    .map((k) => `${k}=${answers[k]}`)
    .join("");
  return createHash("sha256").update(sorted).digest("hex").slice(0, 16);
}

/**
 * De-dupe key. The payload carries NO submission id, and contact_id is stable
 * across every submission from the same person — so keying off contact_id alone
 * would silently drop every repeat submission. Instead we key off:
 *
 *     sha256( contact_id + occurred_at-truncated-to-the-minute + answers-hash )
 *
 * A webhook retry within the same minute carrying identical answers produces
 * the same id and dedupes correctly, while a genuine second submission minutes
 * or days later — or with different answers — hashes differently and comes
 * through as a new lead. When contact_id is absent we fall back to the form id
 * (mediumId) + contact info so malformed payloads still get a deterministic id.
 */
function buildExternalId(
  contactId: string | null,
  formId: string | null,
  email: string | null,
  phone: string | null,
  occurredAt: Date,
  answers: Record<string, string> | null,
): string {
  // Truncate occurred_at to the minute (drop seconds + millis).
  const minuteIso = new Date(
    Math.floor(occurredAt.getTime() / 60000) * 60000,
  ).toISOString();
  const identity = contactId ?? formId ?? (email ?? phone ?? "").toLowerCase();
  const basis = [identity, minuteIso, answersHash(answers)].join("|");
  return "ghlhash_" + createHash("sha256").update(basis).digest("hex").slice(0, 32);
}

/**
 * Normalize a raw GHL form payload into a CanonicalLead. Never throws on shape:
 * missing fields become null and the raw payload is always retained.
 *
 * @param now  Webhook receipt time; also the fallback when the payload's
 *             timestamp is missing or stale (injectable for tests).
 */
export function normalizeGhlForm(payload: unknown, now: Date = new Date()): CanonicalLead {
  const p = asObject(payload);

  // -- Routing keys -------------------------------------------------------
  // contact_source is the brand/property. Stored verbatim on every lead.
  const leadSourceRaw = pick(p, "contact_source");
  // attributionSource.mediumId is the GHL form id — the real backup match key.
  const ghlFormId = pick(p, "attributionSource.mediumId", "contact.attributionSource.mediumId");
  // The page the form was submitted from. Unreliable for GHL-hosted forms
  // (always api.leadconnectorhq.com); the resolver ignores those hosts.
  const pageUrl = pick(p, "attributionSource.url", "contact.attributionSource.url");

  // -- Contact / content --------------------------------------------------
  const email = pick(p, "email", "contact.email");
  const rawPhone = pick(p, "phone", "contact.phone");
  const ghlContactId = pick(p, "contact_id", "contact.id");
  const ghlLocationId = pick(p, "location.id", "contact.location_id");
  const sessionSource = pick(
    p,
    "attributionSource.sessionSource",
    "contact.attributionSource.sessionSource",
  );
  const ip = pick(p, "attributionSource.ip", "contact.attributionSource.ip");

  const formAnswers = collectFormAnswers(p);
  const message = composeMessage(formAnswers);

  // -- Timing -------------------------------------------------------------
  // date_created is the CONTACT's creation date, not the submission's. For a
  // new contact it equals submission time; for a returning contact it's stale.
  // Use it only when it's within 10 minutes of receipt; otherwise fall back to
  // receipt time and note that the provider timestamp was stale.
  const created = parseDate(pick(p, "date_created", "contact.date_created"));
  let occurredAt: Date;
  let occurredAtFallback: boolean;
  let occurredAtNote: string | null;
  if (created == null) {
    occurredAt = now;
    occurredAtFallback = true;
    occurredAtNote = OCCURRED_NOTE_ABSENT;
  } else if (Math.abs(now.getTime() - created.getTime()) <= STALE_TIMESTAMP_MS) {
    occurredAt = created;
    occurredAtFallback = false;
    occurredAtNote = null;
  } else {
    occurredAt = now;
    occurredAtFallback = true;
    occurredAtNote = OCCURRED_NOTE_STALE;
  }

  const externalId = buildExternalId(
    ghlContactId,
    ghlFormId,
    email,
    rawPhone,
    occurredAt,
    formAnswers,
  );

  return {
    provider: PROVIDER,
    externalId,
    type: "form",
    source: mapSource(sessionSource),
    leadSourceRaw,
    ghlFormId,
    pageUrl,
    // Call-only fields — never set for forms.
    trackingPhone: null,
    callDurationSeconds: null,
    callAnswered: null,
    isRepeatCaller: null,
    recordingUrl: null,
    transcript: null,
    callrailCallId: null,
    twilioCallSid: null,
    fullName: fullName(p),
    phone: normalizePhone(rawPhone),
    email,
    message,
    // The real payload carries no form name — only a workflow name, which is a
    // different thing. Leave it null rather than mislabel it.
    formName: null,
    ghlContactId,
    ghlLocationId,
    ip,
    formAnswers,
    occurredAt,
    occurredAtFallback,
    occurredAtNote,
    rawPayload: payload,
  };
}
