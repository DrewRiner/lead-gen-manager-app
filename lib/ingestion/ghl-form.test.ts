import { describe, expect, it } from "vitest";

import { normalizeGhlForm } from "./adapters/ghl-form";

// Receipt time, ~24s after the fixture's date_created — i.e. a brand-new
// contact whose date_created IS the submission time (within the 10-min window).
const NOW = new Date("2026-07-28T21:56:00.000Z");

// ---------------------------------------------------------------------------
// The exact real GHL form payload we captured. Custom form fields ("Property
// Type", "Service Type", ...) arrive as TOP-LEVEL keys named by their label.
// location is OUR agency address; attributionSource.mediumId is the GHL form id.
// ---------------------------------------------------------------------------
function realPayload(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contact_source: "Brunswick Roofing Company",
    contact_id: "bvherLusJmuGVYiE6ho5",
    first_name: "Jane",
    last_name: "Doe",
    full_name: "Jane Doe",
    email: "jane@example.com",
    phone: "+16785555555",
    date_created: "2026-07-28T21:55:36.283Z",
    country: "US",
    timezone: "America/New_York",
    tags: ["roofing"],
    full_address: "123 Main St, Brunswick, GA",
    contact_type: "lead",
    location: {
      id: "loc_agency_1",
      name: "Our Agency",
      address: "1 Agency Way",
      city: "Atlanta",
      state: "GA",
    },
    workflow: { id: "wf_1", name: "New Lead Notification" },
    customData: { test: "1" },
    attributionSource: {
      sessionSource: "Google",
      url: "https://api.leadconnectorhq.com/widget/form/abc",
      referrer: "https://www.google.com/",
      mediumId: "form_med_123",
      medium: "form",
      utmSource: "google",
      gclid: "gclid_xyz",
      ip: "1.2.3.4",
      userAgent: "Mozilla/5.0",
      gaClientId: "GA1.2.3.4",
    },
    contact: {
      attributionSource: { sessionSource: "Google", mediumId: "form_med_123" },
      lastAttributionSource: {},
    },
    // Custom form fields — top-level, keyed by label.
    "Property Type": "Residential",
    "Service Type": "Roof Replacement",
    "Tell us anything we should know": "need a re roof",
    ...over,
  };
}

describe("normalizeGhlForm — real payload", () => {
  it("maps the confirmed field names", () => {
    const c = normalizeGhlForm(realPayload(), NOW);
    expect(c.provider).toBe("ghl");
    expect(c.type).toBe("form");
    // contact_source is the routing key, stored verbatim.
    expect(c.leadSourceRaw).toBe("Brunswick Roofing Company");
    // attributionSource.mediumId is the GHL form id (backup match key).
    expect(c.ghlFormId).toBe("form_med_123");
    // attributionSource.url — the (unreliable) submission page.
    expect(c.pageUrl).toBe("https://api.leadconnectorhq.com/widget/form/abc");
    expect(c.fullName).toBe("Jane Doe");
    expect(c.email).toBe("jane@example.com");
    // Already E.164, still normalized.
    expect(c.phone).toBe("+16785555555");
    expect(c.ghlContactId).toBe("bvherLusJmuGVYiE6ho5");
    // location is OUR agency, never the property — but its id is still captured.
    expect(c.ghlLocationId).toBe("loc_agency_1");
    // sessionSource "Google" -> organic.
    expect(c.source).toBe("organic");
    // Fresh contact: date_created within 10 min of receipt.
    expect(c.occurredAt.toISOString()).toBe("2026-07-28T21:55:36.283Z");
    expect(c.occurredAtFallback).toBe(false);
    expect(c.occurredAtNote).toBeNull();
    expect(c.rawPayload).toEqual(realPayload());
  });

  it("sweeps custom form fields into formAnswers and composes a message", () => {
    const c = normalizeGhlForm(realPayload(), NOW);
    expect(c.formAnswers).toEqual({
      "Property Type": "Residential",
      "Service Type": "Roof Replacement",
      "Tell us anything we should know": "need a re roof",
    });
    expect(c.message).toBe(
      "Property Type: Residential / Service Type: Roof Replacement / " +
        "Tell us anything we should know: need a re roof",
    );
  });

  it("excludes standard fields and empty-valued custom fields from formAnswers", () => {
    const c = normalizeGhlForm(
      realPayload({ "Hidden Field": "", "Best Time to Call": "Morning" }),
      NOW,
    );
    // No standard key leaks in; empty "Hidden Field" is dropped.
    expect(c.formAnswers).toEqual({
      "Property Type": "Residential",
      "Service Type": "Roof Replacement",
      "Tell us anything we should know": "need a re roof",
      "Best Time to Call": "Morning",
    });
    expect(c.formAnswers).not.toHaveProperty("Hidden Field");
    expect(c.formAnswers).not.toHaveProperty("email");
    expect(c.formAnswers).not.toHaveProperty("attributionSource");
  });

  it("null formAnswers/message when there are no custom fields", () => {
    const base = realPayload();
    delete base["Property Type"];
    delete base["Service Type"];
    delete base["Tell us anything we should know"];
    const c = normalizeGhlForm(base, NOW);
    expect(c.formAnswers).toBeNull();
    expect(c.message).toBeNull();
  });

  it("falls back to first_name + last_name when full_name is absent", () => {
    const base = realPayload();
    delete base.full_name;
    const c = normalizeGhlForm(base, NOW);
    expect(c.fullName).toBe("Jane Doe");
  });
});

describe("normalizeGhlForm — source mapping", () => {
  const src = (sessionSource: unknown) =>
    normalizeGhlForm(
      realPayload({
        attributionSource: { sessionSource },
        contact: { attributionSource: { sessionSource } },
      }),
      NOW,
    ).source;

  it("maps 'Direct traffic' -> direct", () => {
    expect(src("Direct traffic")).toBe("direct");
  });
  it("maps anything containing 'google' -> organic", () => {
    expect(src("Google")).toBe("organic");
    expect(src("google organic")).toBe("organic");
    expect(src("Paid Google Ads")).toBe("organic");
  });
  it("maps everything else -> other", () => {
    expect(src("Facebook")).toBe("other");
    expect(src(null)).toBe("other");
    expect(src(undefined)).toBe("other");
  });
});

describe("normalizeGhlForm — occurred_at freshness", () => {
  it("uses date_created when it's within 10 minutes of receipt (new contact)", () => {
    const c = normalizeGhlForm(realPayload(), NOW);
    expect(c.occurredAt.toISOString()).toBe("2026-07-28T21:55:36.283Z");
    expect(c.occurredAtFallback).toBe(false);
    expect(c.occurredAtNote).toBeNull();
  });

  it("falls back to receipt time and notes staleness for a returning contact", () => {
    // date_created weeks in the past — this is a returning contact whose
    // contact-creation date is NOT the submission time.
    const c = normalizeGhlForm(
      realPayload({ date_created: "2026-07-01T10:00:00.000Z" }),
      NOW,
    );
    expect(c.occurredAt.toISOString()).toBe(NOW.toISOString());
    expect(c.occurredAtFallback).toBe(true);
    expect(c.occurredAtNote).toMatch(/stale/i);
  });

  it("falls back and notes absence when there's no timestamp at all", () => {
    const base = realPayload();
    delete base.date_created;
    const c = normalizeGhlForm(base, NOW);
    expect(c.occurredAt.toISOString()).toBe(NOW.toISOString());
    expect(c.occurredAtFallback).toBe(true);
    expect(c.occurredAtNote).toMatch(/no timestamp/i);
  });
});

describe("normalizeGhlForm — deduplication", () => {
  it("two identical submissions one second apart dedupe to the same id", () => {
    // Same payload, receipt times one second apart. Because the contact is
    // fresh, occurredAt = date_created (identical) for both, and the answers
    // are identical, so the external_id matches — a webhook retry, deduped.
    const a = normalizeGhlForm(realPayload(), new Date("2026-07-28T21:56:00.000Z"));
    const b = normalizeGhlForm(realPayload(), new Date("2026-07-28T21:56:01.000Z"));
    expect(a.externalId).toBe(b.externalId);
    expect(a.externalId).toMatch(/^ghlhash_[0-9a-f]{32}$/);
  });

  it("a genuine later resubmission from the same contact is a new lead", () => {
    // Same contact, but a real second submission an hour later (its own fresh
    // date_created) — different minute bucket, so a distinct external_id.
    const first = normalizeGhlForm(
      realPayload({ date_created: "2026-07-28T21:55:36.283Z" }),
      new Date("2026-07-28T21:56:00.000Z"),
    );
    const second = normalizeGhlForm(
      realPayload({ date_created: "2026-07-28T22:55:36.283Z" }),
      new Date("2026-07-28T22:56:00.000Z"),
    );
    expect(first.externalId).not.toBe(second.externalId);
  });

  it("same contact and minute but different answers is a new lead", () => {
    const a = normalizeGhlForm(realPayload(), NOW);
    const b = normalizeGhlForm(
      realPayload({ "Service Type": "Roof Repair" }),
      NOW,
    );
    expect(a.externalId).not.toBe(b.externalId);
  });
});

describe("normalizeGhlForm — missing contact_source", () => {
  it("leaves leadSourceRaw null but keeps the backup match keys", () => {
    const base = realPayload();
    delete base.contact_source;
    const c = normalizeGhlForm(base, NOW);
    expect(c.leadSourceRaw).toBeNull();
    // mediumId + page url survive so the resolver can still try to match.
    expect(c.ghlFormId).toBe("form_med_123");
    expect(c.pageUrl).toBe("https://api.leadconnectorhq.com/widget/form/abc");
    // Still gets a deterministic id (keyed off contact_id).
    expect(c.externalId).toMatch(/^ghlhash_[0-9a-f]{32}$/);
  });
});

describe("normalizeGhlForm — robustness", () => {
  it("retains the full raw payload verbatim", () => {
    const payload = realPayload({ weird_custom_thing: { a: 1 } });
    const c = normalizeGhlForm(payload, NOW);
    expect(c.rawPayload).toBe(payload);
  });

  it("never throws on a garbage payload", () => {
    expect(() => normalizeGhlForm(null, NOW)).not.toThrow();
    expect(() => normalizeGhlForm("a string", NOW)).not.toThrow();
    expect(() => normalizeGhlForm(42, NOW)).not.toThrow();
    const c = normalizeGhlForm(null, NOW);
    expect(c.leadSourceRaw).toBeNull();
    expect(c.formAnswers).toBeNull();
    expect(c.occurredAtFallback).toBe(true);
  });
});
