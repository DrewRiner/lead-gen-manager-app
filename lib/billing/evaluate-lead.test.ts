import { describe, expect, it } from "vitest";

import {
  BILLABLE_REASON,
  evaluateLead,
  type EvaluateLeadProperty,
} from "./evaluate-lead";

// Base property configs for each billing type. Rates are deliberately
// distinct so we can assert exactly which one is snapshotted.
const perLead: EvaluateLeadProperty = {
  billingType: "per_lead",
  perLeadCallRate: "45.00",
  perLeadFormRate: "30.00",
  estimatedCallValue: "90.00",
  estimatedFormValue: "60.00",
  billableThresholdSeconds: 60,
};

const flatMonthly: EvaluateLeadProperty = {
  billingType: "flat_monthly",
  perLeadCallRate: "45.00",
  perLeadFormRate: "30.00",
  estimatedCallValue: "90.00",
  estimatedFormValue: "60.00",
  billableThresholdSeconds: 60,
};

const hybrid: EvaluateLeadProperty = {
  billingType: "hybrid",
  perLeadCallRate: "45.00",
  perLeadFormRate: "30.00",
  estimatedCallValue: "90.00",
  estimatedFormValue: "60.00",
  billableThresholdSeconds: 60,
};

describe("evaluateLead — form leads", () => {
  it("per_lead form lead is billable and charges the form rate", () => {
    const r = evaluateLead({ type: "form", callDurationSeconds: null }, perLead);
    expect(r.billableStatus).toBe("billable");
    expect(r.billableReason).toBe(BILLABLE_REASON.FORM_LEAD);
    expect(r.qualifiedBy).toBe("duration_rule");
    expect(r.billedAmount).toBe("30.00");
    expect(r.estimatedValue).toBe("60.00");
  });

  it("hybrid form lead is billable and charges the form rate", () => {
    const r = evaluateLead({ type: "form", callDurationSeconds: null }, hybrid);
    expect(r.billableStatus).toBe("billable");
    expect(r.billedAmount).toBe("30.00");
    expect(r.estimatedValue).toBe("60.00");
  });

  it("flat_monthly form lead is billable, $0 billed, but records estimated value", () => {
    const r = evaluateLead(
      { type: "form", callDurationSeconds: null },
      flatMonthly,
    );
    expect(r.billableStatus).toBe("billable");
    expect(r.billedAmount).toBe("0.00");
    // The gap is the point: market value is still booked with nothing billed.
    expect(r.estimatedValue).toBe("60.00");
  });
});

describe("evaluateLead — call leads at/over threshold", () => {
  it("per_lead call over threshold is billable and charges the call rate", () => {
    const r = evaluateLead({ type: "call", callDurationSeconds: 120 }, perLead);
    expect(r.billableStatus).toBe("billable");
    expect(r.billableReason).toBe(BILLABLE_REASON.DURATION_MET_THRESHOLD);
    expect(r.qualifiedBy).toBe("duration_rule");
    expect(r.billedAmount).toBe("45.00");
    expect(r.estimatedValue).toBe("90.00");
  });

  it("hybrid call over threshold charges the call rate", () => {
    const r = evaluateLead({ type: "call", callDurationSeconds: 120 }, hybrid);
    expect(r.billableStatus).toBe("billable");
    expect(r.billedAmount).toBe("45.00");
    expect(r.estimatedValue).toBe("90.00");
  });

  it("flat_monthly call over threshold is billable, $0 billed, records estimated value", () => {
    const r = evaluateLead(
      { type: "call", callDurationSeconds: 120 },
      flatMonthly,
    );
    expect(r.billableStatus).toBe("billable");
    expect(r.billedAmount).toBe("0.00");
    expect(r.estimatedValue).toBe("90.00");
  });

  it("boundary: duration EXACTLY equal to threshold is billable", () => {
    const r = evaluateLead({ type: "call", callDurationSeconds: 60 }, perLead);
    expect(r.billableStatus).toBe("billable");
    expect(r.billableReason).toBe(BILLABLE_REASON.DURATION_MET_THRESHOLD);
    expect(r.billedAmount).toBe("45.00");
    expect(r.estimatedValue).toBe("90.00");
  });

  it("respects a non-default per-property threshold", () => {
    const custom = { ...perLead, billableThresholdSeconds: 90 };
    expect(
      evaluateLead({ type: "call", callDurationSeconds: 89 }, custom)
        .billableStatus,
    ).toBe("not_billable");
    expect(
      evaluateLead({ type: "call", callDurationSeconds: 90 }, custom)
        .billableStatus,
    ).toBe("billable");
  });
});

describe("evaluateLead — call leads under threshold", () => {
  it("per_lead call under threshold is not billable, $0 everything", () => {
    const r = evaluateLead({ type: "call", callDurationSeconds: 59 }, perLead);
    expect(r.billableStatus).toBe("not_billable");
    expect(r.billableReason).toBe(BILLABLE_REASON.DURATION_UNDER_THRESHOLD);
    expect(r.qualifiedBy).toBe("duration_rule");
    expect(r.billedAmount).toBe("0.00");
    expect(r.estimatedValue).toBe("0.00");
  });

  it("flat_monthly call under threshold is not billable, $0 everything", () => {
    const r = evaluateLead(
      { type: "call", callDurationSeconds: 10 },
      flatMonthly,
    );
    expect(r.billableStatus).toBe("not_billable");
    expect(r.billedAmount).toBe("0.00");
    expect(r.estimatedValue).toBe("0.00");
  });

  it("zero-second call is not billable", () => {
    const r = evaluateLead({ type: "call", callDurationSeconds: 0 }, perLead);
    expect(r.billableStatus).toBe("not_billable");
    expect(r.billableReason).toBe(BILLABLE_REASON.DURATION_UNDER_THRESHOLD);
  });
});

describe("evaluateLead — call leads with missing duration", () => {
  it("null duration goes to pending_review with $0 everything", () => {
    const r = evaluateLead(
      { type: "call", callDurationSeconds: null },
      perLead,
    );
    expect(r.billableStatus).toBe("pending_review");
    expect(r.billableReason).toBe(BILLABLE_REASON.MISSING_DURATION);
    expect(r.qualifiedBy).toBe("duration_rule");
    expect(r.billedAmount).toBe("0.00");
    expect(r.estimatedValue).toBe("0.00");
  });

  it("pending_review records no estimated value even for a hybrid property", () => {
    const r = evaluateLead(
      { type: "call", callDurationSeconds: null },
      hybrid,
    );
    expect(r.billableStatus).toBe("pending_review");
    expect(r.estimatedValue).toBe("0.00");
  });
});
