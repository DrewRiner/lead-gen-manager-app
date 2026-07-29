import { describe, expect, it } from "vitest";

import { matchProperty, normalizeDomain, type PropertyCandidate } from "./match";

function candidate(over: Partial<PropertyCandidate>): PropertyCandidate {
  return {
    id: "p",
    clientId: null,
    ghlLeadSource: null,
    shortCode: null,
    ghlFormId: null,
    domain: null,
    trackingPhone: null,
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
    const m = matchProperty(POOL, {
      type: "form",
      trackingPhone: null, leadSourceRaw: "Atlanta Roofing", ghlFormId: null, pageUrl: null });
    expect(m?.property.id).toBe("roof");
    expect(m?.strategy).toBe("lead_source");
  });

  it("matches by lead_source case-insensitively and trimmed", () => {
    const m = matchProperty(POOL, {
      type: "form",
      trackingPhone: null,
      leadSourceRaw: "  brunswick FENCE company  ",
      ghlFormId: null,
      pageUrl: null,
    });
    expect(m?.property.id).toBe("fence");
    expect(m?.strategy).toBe("lead_source");
  });

  it("matches by short_code (case-insensitive, trimmed) when lead_source misses", () => {
    const coded = candidate({ id: "coded", shortCode: "ROOF-ATL-01" });
    const pool = [...POOL, coded];
    const m = matchProperty(pool, {
      type: "form",
      trackingPhone: null,
      leadSourceRaw: "  roof-atl-01 ",
      ghlFormId: null,
      pageUrl: null,
    });
    expect(m?.property.id).toBe("coded");
    expect(m?.strategy).toBe("short_code");
  });

  it("prefers ghl_lead_source over short_code when both would match", () => {
    // One property's lead_source equals another property's short_code.
    const byName = candidate({ id: "byName", ghlLeadSource: "Acme Co" });
    const byCode = candidate({ id: "byCode", shortCode: "Acme Co" });
    const m = matchProperty([byName, byCode], {
      type: "form",
      trackingPhone: null,
      leadSourceRaw: "acme co",
      ghlFormId: null,
      pageUrl: null,
    });
    expect(m?.property.id).toBe("byName");
    expect(m?.strategy).toBe("lead_source");
  });

  it("short_code matches before ghl_form_id and page_url", () => {
    const coded = candidate({
      id: "coded",
      shortCode: "CODE9",
      ghlFormId: "other_form",
    });
    const m = matchProperty([coded, FENCE], {
      type: "form",
      trackingPhone: null,
      leadSourceRaw: "code9",
      ghlFormId: "form_fence",
      pageUrl: "https://brunswickfence.com",
    });
    expect(m?.property.id).toBe("coded");
    expect(m?.strategy).toBe("short_code");
  });

  it("falls back to ghl_form_id when lead_source is absent", () => {
    const m = matchProperty(POOL, {
      type: "form",
      trackingPhone: null, leadSourceRaw: null, ghlFormId: "form_roof", pageUrl: null });
    expect(m?.property.id).toBe("roof");
    expect(m?.strategy).toBe("ghl_form_id");
  });

  it("falls back to ghl_form_id when lead_source doesn't match anything", () => {
    const m = matchProperty(POOL, {
      type: "form",
      trackingPhone: null, leadSourceRaw: "Unknown Brand", ghlFormId: "form_fence", pageUrl: null });
    expect(m?.property.id).toBe("fence");
    expect(m?.strategy).toBe("ghl_form_id");
  });

  it("prefers lead_source over form_id when both would match", () => {
    // lead_source points at fence, form_id points at roof -> lead_source wins.
    const m = matchProperty(POOL, {
      type: "form",
      trackingPhone: null,
      leadSourceRaw: "Brunswick Fence Company",
      ghlFormId: "form_roof",
      pageUrl: null,
    });
    expect(m?.property.id).toBe("fence");
    expect(m?.strategy).toBe("lead_source");
  });

  it("matches by page_url hostname when source and form id are absent", () => {
    const m = matchProperty(POOL, {
      type: "form",
      trackingPhone: null,
      leadSourceRaw: null,
      ghlFormId: null,
      pageUrl: "https://WWW.BrunswickFence.com/contact?utm=abc",
    });
    expect(m?.property.id).toBe("fence");
    expect(m?.strategy).toBe("page_url");
  });

  it("normalizes both sides of the page_url comparison (property domain has scheme + www + slash)", () => {
    const m = matchProperty(POOL, {
      type: "form",
      trackingPhone: null,
      leadSourceRaw: null,
      ghlFormId: null,
      pageUrl: "atlantaroofing.com/quote",
    });
    expect(m?.property.id).toBe("roof");
    expect(m?.strategy).toBe("page_url");
  });

  it("ignores GHL-hosted page_url hosts (leadconnectorhq.com)", () => {
    // GHL-hosted forms always report a leadconnectorhq.com host, which
    // identifies the provider, not the property — so it must never match.
    const m = matchProperty(POOL, {
      type: "form",
      trackingPhone: null,
      leadSourceRaw: null,
      ghlFormId: null,
      pageUrl: "https://api.leadconnectorhq.com/widget/form/abc",
    });
    expect(m).toBeNull();
  });

  it("ignores gohighlevel.com and its subdomains as page_url hosts", () => {
    expect(
      matchProperty(POOL, {
      type: "form",
      trackingPhone: null,
        leadSourceRaw: null,
        ghlFormId: null,
        pageUrl: "https://link.gohighlevel.com/x",
      }),
    ).toBeNull();
  });

  it("still matches a real property domain even though GHL hosts are ignored", () => {
    const m = matchProperty(POOL, {
      type: "form",
      trackingPhone: null,
      leadSourceRaw: null,
      ghlFormId: null,
      pageUrl: "https://brunswickfence.com/contact",
    });
    expect(m?.property.id).toBe("fence");
    expect(m?.strategy).toBe("page_url");
  });

  it("falls back to a GHL-hosted page_url producing no match => unmatched", () => {
    // contact_source absent, mediumId doesn't match, host is GHL-hosted.
    const m = matchProperty(POOL, {
      type: "form",
      trackingPhone: null,
      leadSourceRaw: null,
      ghlFormId: "unknown_form",
      pageUrl: "https://api.leadconnectorhq.com/widget/form/xyz",
    });
    expect(m).toBeNull();
  });

  it("returns null when nothing matches (=> unmatched lead)", () => {
    const m = matchProperty(POOL, {
      type: "form",
      trackingPhone: null,
      leadSourceRaw: "Totally Unknown",
      ghlFormId: "nope",
      pageUrl: "https://someoneelse.com",
    });
    expect(m).toBeNull();
  });

  it("returns null when all hints are empty", () => {
    expect(matchProperty(POOL, {
      type: "form",
      trackingPhone: null, leadSourceRaw: null, ghlFormId: null, pageUrl: null })).toBeNull();
    expect(matchProperty(POOL, {
      type: "form",
      trackingPhone: null, leadSourceRaw: "   ", ghlFormId: "", pageUrl: "" })).toBeNull();
  });
});

describe("matchProperty — CallRail calls (by dialed tracking number)", () => {
  const CALL_FENCE = candidate({ id: "fence", trackingPhone: "+19045550100" });
  const CALL_ROOF = candidate({ id: "roof", trackingPhone: "+14045550200" });
  const CALL_POOL = [CALL_FENCE, CALL_ROOF];

  function callLead(over: {
    trackingPhone?: string | null;
    leadSourceRaw?: string | null;
  }) {
    return {
      type: "call" as const,
      trackingPhone: over.trackingPhone ?? null,
      leadSourceRaw: over.leadSourceRaw ?? null,
      ghlFormId: null,
      pageUrl: null,
    };
  }

  it("resolves by the dialed tracking number", () => {
    const m = matchProperty(CALL_POOL, callLead({ trackingPhone: "+19045550100" }));
    expect(m?.property.id).toBe("fence");
    expect(m?.strategy).toBe("tracking_phone");
  });

  it("normalizes messy tracking-number formats to match (E.164)", () => {
    // Property stored as E.164; inbound formatted differently -> still matches.
    for (const messy of ["(404) 555-0200", "404-555-0200", "4045550200", "+1 404 555 0200"]) {
      const m = matchProperty(CALL_POOL, callLead({ trackingPhone: messy }));
      expect(m?.property.id).toBe("roof");
      expect(m?.strategy).toBe("tracking_phone");
    }
  });

  it("returns null (unmatched) when no property owns the dialed number", () => {
    expect(matchProperty(CALL_POOL, callLead({ trackingPhone: "+19998887777" }))).toBeNull();
  });

  it("never matches a call by anything but the tracking number", () => {
    // Even if a lead_source-like value is present, a call only routes by number.
    const m = matchProperty(
      [candidate({ id: "fence", ghlLeadSource: "Brunswick Fence Company", trackingPhone: null })],
      callLead({ trackingPhone: null, leadSourceRaw: "Brunswick Fence Company" }),
    );
    expect(m).toBeNull();
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
