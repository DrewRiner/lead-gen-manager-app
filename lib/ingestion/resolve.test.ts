import { describe, expect, it } from "vitest";

import { matchProperty, normalizeDomain, type PropertyCandidate } from "./match";

function candidate(over: Partial<PropertyCandidate>): PropertyCandidate {
  return {
    id: "p",
    clientId: null,
    ghlLeadSource: null,
    ghlFormId: null,
    domain: null,
    billingType: "flat_monthly",
    perLeadCallRate: "0",
    perLeadFormRate: "0",
    estimatedCallValue: "0",
    estimatedFormValue: "0",
    billableThresholdSeconds: 60,
    ...over,
  };
}

const FENCE = candidate({
  id: "fence",
  ghlLeadSource: "Brunswick Fence Company",
  ghlFormId: "form_fence",
  domain: "brunswickfence.com",
});
const ROOF = candidate({
  id: "roof",
  ghlLeadSource: "Atlanta Roofing",
  ghlFormId: "form_roof",
  domain: "https://www.atlantaroofing.com/",
});
const POOL = [FENCE, ROOF];

describe("matchProperty", () => {
  it("matches by lead_source (exact)", () => {
    const m = matchProperty(POOL, { leadSourceRaw: "Atlanta Roofing", ghlFormId: null, pageUrl: null });
    expect(m?.property.id).toBe("roof");
    expect(m?.strategy).toBe("lead_source");
  });

  it("matches by lead_source case-insensitively and trimmed", () => {
    const m = matchProperty(POOL, {
      leadSourceRaw: "  brunswick FENCE company  ",
      ghlFormId: null,
      pageUrl: null,
    });
    expect(m?.property.id).toBe("fence");
    expect(m?.strategy).toBe("lead_source");
  });

  it("falls back to ghl_form_id when lead_source is absent", () => {
    const m = matchProperty(POOL, { leadSourceRaw: null, ghlFormId: "form_roof", pageUrl: null });
    expect(m?.property.id).toBe("roof");
    expect(m?.strategy).toBe("ghl_form_id");
  });

  it("falls back to ghl_form_id when lead_source doesn't match anything", () => {
    const m = matchProperty(POOL, { leadSourceRaw: "Unknown Brand", ghlFormId: "form_fence", pageUrl: null });
    expect(m?.property.id).toBe("fence");
    expect(m?.strategy).toBe("ghl_form_id");
  });

  it("prefers lead_source over form_id when both would match", () => {
    // lead_source points at fence, form_id points at roof -> lead_source wins.
    const m = matchProperty(POOL, {
      leadSourceRaw: "Brunswick Fence Company",
      ghlFormId: "form_roof",
      pageUrl: null,
    });
    expect(m?.property.id).toBe("fence");
    expect(m?.strategy).toBe("lead_source");
  });

  it("matches by page_url hostname when source and form id are absent", () => {
    const m = matchProperty(POOL, {
      leadSourceRaw: null,
      ghlFormId: null,
      pageUrl: "https://WWW.BrunswickFence.com/contact?utm=abc",
    });
    expect(m?.property.id).toBe("fence");
    expect(m?.strategy).toBe("page_url");
  });

  it("normalizes both sides of the page_url comparison (property domain has scheme + www + slash)", () => {
    const m = matchProperty(POOL, {
      leadSourceRaw: null,
      ghlFormId: null,
      pageUrl: "atlantaroofing.com/quote",
    });
    expect(m?.property.id).toBe("roof");
    expect(m?.strategy).toBe("page_url");
  });

  it("returns null when nothing matches (=> unmatched lead)", () => {
    const m = matchProperty(POOL, {
      leadSourceRaw: "Totally Unknown",
      ghlFormId: "nope",
      pageUrl: "https://someoneelse.com",
    });
    expect(m).toBeNull();
  });

  it("returns null when all hints are empty", () => {
    expect(matchProperty(POOL, { leadSourceRaw: null, ghlFormId: null, pageUrl: null })).toBeNull();
    expect(matchProperty(POOL, { leadSourceRaw: "   ", ghlFormId: "", pageUrl: "" })).toBeNull();
  });
});

describe("normalizeDomain", () => {
  it.each([
    ["https://WWW.Example.com/contact/?x=1", "example.com"],
    ["http://example.com", "example.com"],
    ["example.com", "example.com"],
    ["EXAMPLE.COM/", "example.com"],
    ["www.example.com", "example.com"],
    ["https://example.com:8443/path", "example.com"],
    ["user:pass@sub.example.com/x", "sub.example.com"],
    ["  https://example.com  ", "example.com"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it("returns null for empty / nullish input", () => {
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain(undefined)).toBeNull();
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("   ")).toBeNull();
  });
});
