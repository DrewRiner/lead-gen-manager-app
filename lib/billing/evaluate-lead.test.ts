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

// A legit form submission with real contact info.
const validForm = {
  email: "jane@acme.com",
  phone: "+14045551212",
  name: "Jane Smith",
  message: "I need a quote for a new roof.",
  hasFormAnswers: false,
};

describe("evaluateLead — form leads (form_validation)", () => {
  it("per_lead form with valid contact is billable at the form rate", async () => {
    const r = await evaluateLead(
      { type: "form", callDurationSeconds: null, form: validForm },
      perLead,
    );
    expect(r.billableStatus).toBe("billable");
    expect(r.billableReason).toBe(BILLABLE_REASON.VALID_CONTACT);
    expect(r.qualifiedBy).toBe("form_validation");
    expect(r.billedAmount).toBe("30.00");
    expect(r.estimatedValue).toBe("60.00");
  });

  it("a valid email ONLY (no phone) is enough to be billable", async () => {
    const r = await evaluateLead(
      {
        type: "form",
        callDurationSeconds: null,
        form: { ...validForm, phone: null },
      },
      perLead,
    );
    expect(r.billableStatus).toBe("billable");
    expect(r.qualifiedBy).toBe("form_validation");
  });

  it("hybrid form charges the form rate", async () => {
    const r = await evaluateLead(
      { type: "form", callDurationSeconds: null, form: validForm },
      hybrid,
    );
    expect(r.billedAmount).toBe("30.00");
    expect(r.estimatedValue).toBe("60.00");
  });

  it("flat_monthly form is billable, $0 billed, records estimated value", async () => {
    const r = await evaluateLead(
      { type: "form", callDurationSeconds: null, form: validForm },
      flatMonthly,
    );
    expect(r.billableStatus).toBe("billable");
    expect(r.billedAmount).toBe("0.00");
    expect(r.estimatedValue).toBe("60.00");
  });

  it("no email AND no phone -> not_billable / no_contact_info", async () => {
    const r = await evaluateLead(
      {
        type: "form",
        callDurationSeconds: null,
        form: { email: null, phone: null, name: "Jane", message: "hi", hasFormAnswers: false },
      },
      perLead,
    );
    expect(r.billableStatus).toBe("not_billable");
    expect(r.billableReason).toBe(BILLABLE_REASON.NO_CONTACT);
    expect(r.qualifiedBy).toBe("form_validation");
    expect(r.billedAmount).toBe("0.00");
    expect(r.estimatedValue).toBe("0.00");
  });

  it("the Sumter 'test test' junk lead -> low_quality / not billable", async () => {
    // Real values in the system: name "test test", email test123@live.com,
    // phone (912) 555-5555. Junk name + test email = 2 signals.
    const r = await evaluateLead(
      {
        type: "form",
        callDurationSeconds: null,
        form: {
          email: "test123@live.com",
          phone: "+19125555555",
          name: "test test",
          message: null,
          hasFormAnswers: false,
        },
      },
      perLead,
    );
    expect(r.billableStatus).toBe("not_billable");
    expect(r.billableReason).toBe(BILLABLE_REASON.LOW_QUALITY);
    expect(r.qualifiedBy).toBe("form_validation");
  });

  it("a sparse but legit lead (drew riner) stays billable", async () => {
    const r = await evaluateLead(
      {
        type: "form",
        callDurationSeconds: null,
        form: {
          email: "drewriner@hotmail.com",
          phone: null,
          name: "drew riner",
          message: "roof leak",
          hasFormAnswers: false,
        },
      },
      perLead,
    );
    expect(r.billableStatus).toBe("billable");
    expect(r.qualifiedBy).toBe("form_validation");
  });

  it("with no form field provided, a form is billable (legacy/seed path)", async () => {
    const r = await evaluateLead({ type: "form", callDurationSeconds: null }, perLead);
    expect(r.billableStatus).toBe("billable");
    expect(r.qualifiedBy).toBe("form_validation");
  });

  it("no form path returns duration_rule; no call path returns form_validation", async () => {
    const form = await evaluateLead(
      { type: "form", callDurationSeconds: null, form: validForm },
      perLead,
    );
    expect(form.qualifiedBy).not.toBe("duration_rule");
    const formJunk = await evaluateLead(
      {
        type: "form",
        callDurationSeconds: null,
        form: { email: null, phone: null, name: null, message: null, hasFormAnswers: false },
      },
      perLead,
    );
    expect(formJunk.qualifiedBy).not.toBe("duration_rule");

    const call = await evaluateLead({ type: "call", callDurationSeconds: 120 }, perLead);
    expect(call.qualifiedBy).not.toBe("form_validation");
    expect(call.qualifiedBy).toBe("duration_rule");
  });
});

describe("evaluateLead — call leads at/over threshold", () => {
  it("per_lead call over threshold is billable and charges the call rate", async () => {
    const r = await evaluateLead({ type: "call", callDurationSeconds: 120 }, perLead);
    expect(r.billableStatus).toBe("billable");
    expect(r.billableReason).toBe(BILLABLE_REASON.DURATION_MET_THRESHOLD);
    expect(r.qualifiedBy).toBe("duration_rule");
    expect(r.billedAmount).toBe("45.00");
    expect(r.estimatedValue).toBe("90.00");
  });

  it("hybrid call over threshold charges the call rate", async () => {
    const r = await evaluateLead({ type: "call", callDurationSeconds: 120 }, hybrid);
    expect(r.billableStatus).toBe("billable");
    expect(r.billedAmount).toBe("45.00");
    expect(r.estimatedValue).toBe("90.00");
  });

  it("flat_monthly call over threshold is billable, $0 billed, records estimated value", async () => {
    const r = await evaluateLead(
      { type: "call", callDurationSeconds: 120 },
      flatMonthly,
    );
    expect(r.billableStatus).toBe("billable");
    expect(r.billedAmount).toBe("0.00");
    expect(r.estimatedValue).toBe("90.00");
  });

  it("boundary: duration EXACTLY equal to threshold is billable", async () => {
    const r = await evaluateLead({ type: "call", callDurationSeconds: 60 }, perLead);
    expect(r.billableStatus).toBe("billable");
    expect(r.billableReason).toBe(BILLABLE_REASON.DURATION_MET_THRESHOLD);
    expect(r.billedAmount).toBe("45.00");
    expect(r.estimatedValue).toBe("90.00");
  });

  it("respects a non-default per-property threshold", async () => {
    const custom = { ...perLead, billableThresholdSeconds: 90 };
    expect(
      (await evaluateLead({ type: "call", callDurationSeconds: 89 }, custom))
        .billableStatus,
    ).toBe("not_billable");
    expect(
      (await evaluateLead({ type: "call", callDurationSeconds: 90 }, custom))
        .billableStatus,
    ).toBe("billable");
  });
});

describe("evaluateLead — call leads under threshold", () => {
  it("per_lead call under threshold is not billable, $0 everything", async () => {
    const r = await evaluateLead({ type: "call", callDurationSeconds: 59 }, perLead);
    expect(r.billableStatus).toBe("not_billable");
    expect(r.billableReason).toBe(BILLABLE_REASON.DURATION_UNDER_THRESHOLD);
    expect(r.qualifiedBy).toBe("duration_rule");
    expect(r.billedAmount).toBe("0.00");
    expect(r.estimatedValue).toBe("0.00");
  });

  it("flat_monthly call under threshold is not billable, $0 everything", async () => {
    const r = await evaluateLead(
      { type: "call", callDurationSeconds: 10 },
      flatMonthly,
    );
    expect(r.billableStatus).toBe("not_billable");
    expect(r.billedAmount).toBe("0.00");
    expect(r.estimatedValue).toBe("0.00");
  });

  it("zero-second call is not billable", async () => {
    const r = await evaluateLead({ type: "call", callDurationSeconds: 0 }, perLead);
    expect(r.billableStatus).toBe("not_billable");
    expect(r.billableReason).toBe(BILLABLE_REASON.DURATION_UNDER_THRESHOLD);
  });
});

describe("evaluateLead — call leads with missing duration", () => {
  it("null duration goes to pending_review with $0 everything", async () => {
    const r = await evaluateLead(
      { type: "call", callDurationSeconds: null },
      perLead,
    );
    expect(r.billableStatus).toBe("pending_review");
    expect(r.billableReason).toBe(BILLABLE_REASON.MISSING_DURATION);
    expect(r.qualifiedBy).toBe("duration_rule");
    expect(r.billedAmount).toBe("0.00");
    expect(r.estimatedValue).toBe("0.00");
  });

  it("pending_review records no estimated value even for a hybrid property", async () => {
    const r = await evaluateLead(
      { type: "call", callDurationSeconds: null },
      hybrid,
    );
    expect(r.billableStatus).toBe("pending_review");
    expect(r.estimatedValue).toBe("0.00");
  });
});
