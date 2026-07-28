import { createHash } from "node:crypto";

import { normalizePhone } from "@/lib/phone";
import type { CanonicalLead } from "@/lib/ingestion/types";

// ---------------------------------------------------------------------------
// GoHighLevel form-submission adapter. GHL's webhook payloads are inconsistent
// (snake_case, camelCase, nested under contact/form/customData, values as
// arrays), so every field is read defensively across the shapes we've seen.
// Anything we don't recognize still survives verbatim in rawPayload.
//
// This adapter is provider #1. CallRail / Twilio later add sibling files that
// export the same normalize(payload) -> CanonicalLead signature.
// ---------------------------------------------------------------------------

export const PROVIDER = "ghl";

type Json = Record<string, unknown>;

function asObject(v: unknown): Json {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Json)
    : {};
}

/** First non-empty string among the given dotted paths (e.g. "contact.email"). */
function pick(payload: Json, ...paths: string[]): string | null {
  for (const path of paths) {
    let cur: unknown = payload;
    for (const seg of path.split(".")) {
      cur = asObject(cur)[seg];
      if (cur == null) break;
    }
    // GHL sometimes delivers a field as a single-element array.
    if (Array.isArray(cur)) cur = cur[0];
    if (typeof cur === "number") cur = String(cur);
    if (typeof cur === "string") {
      const t = cur.trim();
      if (t.length > 0) return t;
    }
  }
  return null;
}

/** Parse a timestamp from the payload; null when absent/unparseable. */
function parseOccurredAt(payload: Json): Date | null {
  const raw = pick(
    payload,
    "occurred_at",
    "occurredAt",
    "created_at",
    "createdAt",
    "date_created",
    "dateCreated",
    "date_added",
    "dateAdded",
    "timestamp",
    "submitted_at",
    "submittedAt",
    "contact.date_created",
  );
  if (!raw) return null;
  // Numeric epoch (seconds or millis).
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
  const direct = pick(
    payload,
    "full_name",
    "fullName",
    "name",
    "contact.full_name",
    "contact.fullName",
    "contact.name",
  );
  if (direct) return direct;
  const first = pick(payload, "first_name", "firstName", "contact.first_name", "contact.firstName");
  const last = pick(payload, "last_name", "lastName", "contact.last_name", "contact.lastName");
  const joined = [first, last].filter(Boolean).join(" ").trim();
  return joined.length > 0 ? joined : null;
}

/**
 * Deterministic fallback id: hash of form id + email/phone + timestamp. Used
 * only when the payload carries no submission/contact id. Deterministic so the
 * same submission replayed produces the same id and de-dupes correctly.
 */
function synthesizeExternalId(
  formId: string | null,
  email: string | null,
  phone: string | null,
  occurredIso: string,
): string {
  const basis = [formId ?? "", (email ?? phone ?? "").toLowerCase(), occurredIso].join("|");
  return "ghlhash_" + createHash("sha256").update(basis).digest("hex").slice(0, 32);
}

/**
 * Normalize a raw GHL form payload into a CanonicalLead. Never throws on shape:
 * missing fields become null and the raw payload is always retained.
 *
 * @param now  Fallback timestamp when the payload has none (injectable for tests).
 */
export function normalizeGhlForm(payload: unknown, now: Date = new Date()): CanonicalLead {
  const p = asObject(payload);

  const leadSourceRaw = pick(
    p,
    "lead_source",
    "leadSource",
    "source",
    "contact.source",
    "customData.lead_source",
    "customData.leadSource",
  );
  const ghlFormId = pick(p, "form_id", "formId", "form.id", "formID");
  const pageUrl = pick(p, "page_url", "pageUrl", "page.url", "url", "contact.last_page_visited");
  const formName = pick(p, "form_name", "formName", "form.name");
  const email = pick(p, "email", "contact.email", "customData.email");
  const rawPhone = pick(p, "phone", "phone_number", "phoneNumber", "contact.phone", "customData.phone");
  const message = pick(p, "message", "comments", "notes", "customData.message", "customData.comments");
  const ghlContactId = pick(p, "contact_id", "contactId", "contact.id");
  const ghlLocationId = pick(p, "location_id", "locationId", "location.id", "contact.location_id");

  const parsedOccurred = parseOccurredAt(p);
  const occurredAt = parsedOccurred ?? now;
  const occurredAtFallback = parsedOccurred == null;

  const externalIdDirect = pick(
    p,
    "submission_id",
    "submissionId",
    "id",
    "event_id",
    "eventId",
    "contact.id",
  );
  const externalId =
    externalIdDirect ??
    synthesizeExternalId(ghlFormId, email, rawPhone, occurredAt.toISOString());

  return {
    provider: PROVIDER,
    externalId,
    type: "form",
    source: "organic",
    leadSourceRaw,
    ghlFormId,
    pageUrl,
    fullName: fullName(p),
    phone: normalizePhone(rawPhone),
    email,
    message,
    formName,
    ghlContactId,
    ghlLocationId,
    occurredAt,
    occurredAtFallback,
    rawPayload: payload,
  };
}
