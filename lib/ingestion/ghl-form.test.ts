import { describe, expect, it } from "vitest";

import { normalizeGhlForm } from "./adapters/ghl-form";

const NOW = new Date("2026-07-28T12:00:00Z");

describe("normalizeGhlForm — defensive field reading", () => {
  it("reads a canonical snake_case payload", () => {
    const c = normalizeGhlForm(
      {
        submission_id: "sub_1",
        lead_source: "Brunswick Fence Company",
        form_id: "form_abc",
        form_name: "Contact form",
        page_url: "https://brunswickfence.com/contact",
        first_name: "Jane",
        last_name: "Doe",
        email: "jane@example.com",
        phone: "904-555-1234",
        message: "Need a fence quote",
        contact_id: "con_1",
        location_id: "loc_1",
        created_at: "2026-07-20T15:30:00Z",
      },
      NOW,
    );
    expect(c.provider).toBe("ghl");
    expect(c.externalId).toBe("sub_1");
    expect(c.type).toBe("form");
    expect(c.source).toBe("organic");
    expect(c.leadSourceRaw).toBe("Brunswick Fence Company");
    expect(c.ghlFormId).toBe("form_abc");
    expect(c.formName).toBe("Contact form");
    expect(c.pageUrl).toBe("https://brunswickfence.com/contact");
    expect(c.fullName).toBe("Jane Doe");
    expect(c.email).toBe("jane@example.com");
    expect(c.phone).toBe("+19045551234"); // E.164
    expect(c.message).toBe("Need a fence quote");
    expect(c.ghlContactId).toBe("con_1");
    expect(c.ghlLocationId).toBe("loc_1");
    expect(c.occurredAt.toISOString()).toBe("2026-07-20T15:30:00.000Z");
    expect(c.occurredAtFallback).toBe(false);
  });

  it("reads camelCase and nested variants", () => {
    const c = normalizeGhlForm(
      {
        submissionId: "sub_2",
        leadSource: "Yuma Tinting",
        formId: "f2",
        pageUrl: "https://x.com",
        contact: { first_name: "Al", last_name: "Bo", email: "al@x.com", source: "ignored" },
        dateCreated: "2026-07-19T10:00:00Z",
      },
      NOW,
    );
    expect(c.externalId).toBe("sub_2");
    expect(c.leadSourceRaw).toBe("Yuma Tinting"); // top-level leadSource wins over contact.source
    expect(c.ghlFormId).toBe("f2");
    expect(c.fullName).toBe("Al Bo");
    expect(c.email).toBe("al@x.com");
  });

  it("falls back through source fields: source, then contact.source", () => {
    expect(normalizeGhlForm({ source: "PlainSource" }, NOW).leadSourceRaw).toBe("PlainSource");
    expect(
      normalizeGhlForm({ contact: { source: "NestedSource" } }, NOW).leadSourceRaw,
    ).toBe("NestedSource");
  });

  it("reads message from comments/notes fallbacks", () => {
    expect(normalizeGhlForm({ comments: "hi" }, NOW).message).toBe("hi");
    expect(normalizeGhlForm({ notes: "yo" }, NOW).message).toBe("yo");
  });

  it("uses contact.id as external id when no submission id", () => {
    const c = normalizeGhlForm({ contact: { id: "con_9" }, lead_source: "S" }, NOW);
    expect(c.externalId).toBe("con_9");
  });

  it("synthesizes a deterministic external id when none is present", () => {
    const payload = { form_id: "f", email: "a@b.com", created_at: "2026-01-01T00:00:00Z" };
    const a = normalizeGhlForm(payload, NOW);
    const b = normalizeGhlForm(payload, new Date("2030-01-01T00:00:00Z"));
    expect(a.externalId).toMatch(/^ghlhash_[0-9a-f]{32}$/);
    // Deterministic: same submission -> same id regardless of receipt time.
    expect(a.externalId).toBe(b.externalId);
  });

  it("different submissions synthesize different ids", () => {
    const a = normalizeGhlForm({ form_id: "f", email: "a@b.com", created_at: "2026-01-01T00:00:00Z" }, NOW);
    const b = normalizeGhlForm({ form_id: "f", email: "c@d.com", created_at: "2026-01-01T00:00:00Z" }, NOW);
    expect(a.externalId).not.toBe(b.externalId);
  });

  it("falls back to `now` and flags it when the payload has no timestamp", () => {
    const c = normalizeGhlForm({ submission_id: "s", lead_source: "X" }, NOW);
    expect(c.occurredAt.toISOString()).toBe(NOW.toISOString());
    expect(c.occurredAtFallback).toBe(true);
  });

  it("parses an epoch-millis timestamp", () => {
    const c = normalizeGhlForm({ submission_id: "s", timestamp: "1750000000000" }, NOW);
    expect(c.occurredAtFallback).toBe(false);
    expect(c.occurredAt.getTime()).toBe(1750000000000);
  });

  it("retains the full raw payload verbatim, including unrecognized fields", () => {
    const payload = { submission_id: "s", lead_source: "X", weird_custom_thing: { a: 1 } };
    const c = normalizeGhlForm(payload, NOW);
    expect(c.rawPayload).toBe(payload);
    expect((c.rawPayload as Record<string, unknown>).weird_custom_thing).toEqual({ a: 1 });
  });

  it("never throws on a garbage payload", () => {
    expect(() => normalizeGhlForm(null, NOW)).not.toThrow();
    expect(() => normalizeGhlForm("a string", NOW)).not.toThrow();
    expect(() => normalizeGhlForm(42, NOW)).not.toThrow();
    const c = normalizeGhlForm(null, NOW);
    expect(c.leadSourceRaw).toBeNull();
    expect(c.occurredAtFallback).toBe(true);
  });
});
