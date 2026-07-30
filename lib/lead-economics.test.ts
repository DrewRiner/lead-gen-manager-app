import { describe, expect, it } from "vitest";

import {
  computeLeadEconomics,
  effectiveCostPerLead,
  type LeadEconomicsInput,
} from "@/lib/lead-economics";

const base: LeadEconomicsInput = {
  billingType: "flat_monthly",
  hasActiveAssignment: true,
  billableLeads: 10,
  flatBookedThisMonth: "500.00",
  perLeadBilledThisMonth: "0.00",
  estimatedCallValue: "50.00",
  estimatedFormValue: "25.00",
  calls: 6,
  forms: 4,
};

describe("effectiveCostPerLead", () => {
  it("flat_monthly: monthly_rate / billable leads", () => {
    expect(effectiveCostPerLead({ ...base })).toBe(50); // 500 / 10
  });

  it("hybrid uses the flat rate booked / billable leads", () => {
    expect(
      effectiveCostPerLead({ ...base, billingType: "hybrid", flatBookedThisMonth: "300", billableLeads: 6 }),
    ).toBe(50);
  });

  it("per_lead: average actually billed per billable lead", () => {
    expect(
      effectiveCostPerLead({
        ...base,
        billingType: "per_lead",
        flatBookedThisMonth: "0",
        perLeadBilledThisMonth: "450",
        billableLeads: 10,
      }),
    ).toBe(45);
  });

  it("unrented (no active assignment) => null", () => {
    expect(effectiveCostPerLead({ ...base, hasActiveAssignment: false })).toBeNull();
  });

  it("zero billable leads => null (no divide-by-zero)", () => {
    expect(effectiveCostPerLead({ ...base, billableLeads: 0 })).toBeNull();
  });

  it("trial (flat booked 0) => $0/lead, not a divide error", () => {
    expect(
      effectiveCostPerLead({ ...base, flatBookedThisMonth: "0", billableLeads: 5 }),
    ).toBe(0);
  });
});

describe("computeLeadEconomics — market label", () => {
  it("distinct call/form values render both", () => {
    const e = computeLeadEconomics(base);
    expect(e.marketLabel).toBe("$50/call · $25/form");
    expect(e.marketCall).toBe(50);
    expect(e.marketForm).toBe(25);
  });

  it("equal call/form values render a single /lead figure", () => {
    const e = computeLeadEconomics({ ...base, estimatedFormValue: "50.00" });
    expect(e.marketLabel).toBe("$50/lead");
  });

  it("only one rate set renders just that one", () => {
    expect(computeLeadEconomics({ ...base, estimatedFormValue: "0" }).marketLabel).toBe("$50/call");
    expect(computeLeadEconomics({ ...base, estimatedCallValue: "0" }).marketLabel).toBe("$25/form");
  });

  it("no rates set => —", () => {
    expect(
      computeLeadEconomics({ ...base, estimatedCallValue: "0", estimatedFormValue: "0" }).marketLabel,
    ).toBe("—");
  });

  it("drops trailing .00 but keeps real cents", () => {
    expect(computeLeadEconomics({ ...base, estimatedCallValue: "50", estimatedFormValue: "50" }).marketLabel).toBe(
      "$50/lead",
    );
    expect(
      computeLeadEconomics({ ...base, estimatedCallValue: "12.50", estimatedFormValue: "12.50" }).marketLabel,
    ).toBe("$12.50/lead");
  });
});

describe("computeLeadEconomics — effective label + underpriced cue", () => {
  it("labels effective as $/lead", () => {
    expect(computeLeadEconomics(base).effectiveLabel).toBe("$50/lead");
  });

  it("unrented shows — and is not flagged underpriced", () => {
    const e = computeLeadEconomics({ ...base, hasActiveAssignment: false });
    expect(e.effectiveLabel).toBe("—");
    expect(e.underpriced).toBe(false);
  });

  it("flags underpriced when effective is well below blended market", () => {
    // blended market with 6 calls @ $50 + 4 forms @ $25 = (300+100)/10 = $40.
    // Effective $10/lead (100 flat / 10 leads) is < 0.6 * 40 = 24 → underpriced.
    const e = computeLeadEconomics({ ...base, flatBookedThisMonth: "100" });
    expect(e.marketBlended).toBe(40);
    expect(e.effectiveValue).toBe(10);
    expect(e.underpriced).toBe(true);
  });

  it("does NOT flag when effective is close to market", () => {
    // Effective $50/lead vs blended $40 → above threshold, not underpriced.
    expect(computeLeadEconomics(base).underpriced).toBe(false);
  });

  it("blends market by the month's call/form mix", () => {
    // All calls this month => blended = call value.
    expect(computeLeadEconomics({ ...base, calls: 10, forms: 0 }).marketBlended).toBe(50);
    // All forms => blended = form value.
    expect(computeLeadEconomics({ ...base, calls: 0, forms: 10 }).marketBlended).toBe(25);
  });

  it("with no leads yet, blended falls back to the average of set rates", () => {
    expect(computeLeadEconomics({ ...base, calls: 0, forms: 0 }).marketBlended).toBe(37.5);
  });
});
