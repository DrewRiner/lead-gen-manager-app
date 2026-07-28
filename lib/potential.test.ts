import { describe, expect, it } from "vitest";

import { potentialPerLead } from "./potential";

describe("potentialPerLead", () => {
  it("flat-rate property: no per-lead charge, so uses estimated_value (market)", () => {
    // flat_monthly lead: billed_amount is 0, estimated_value carries market value.
    expect(
      potentialPerLead({ billableStatus: "billable", billedAmount: "0.00", estimatedValue: "60.00" }),
    ).toBe(60);
  });

  it("per-lead property: uses the recorded per-lead billed_amount", () => {
    // per_lead lead: billed the per-lead rate (below market), estimated is higher.
    expect(
      potentialPerLead({ billableStatus: "billable", billedAmount: "40.00", estimatedValue: "90.00" }),
    ).toBe(40);
  });

  it("hybrid property: uses the recorded per-lead billed_amount (not the flat part)", () => {
    expect(
      potentialPerLead({ billableStatus: "billable", billedAmount: "35.00", estimatedValue: "85.00" }),
    ).toBe(35);
  });

  it("non-billable / spam / pending_review / disputed all contribute zero", () => {
    for (const s of ["not_billable", "spam", "pending_review", "disputed"]) {
      expect(
        potentialPerLead({ billableStatus: s, billedAmount: "0.00", estimatedValue: "0.00" }),
      ).toBe(0);
    }
    // Even if some value were present, a non-billable lead is still zero.
    expect(
      potentialPerLead({ billableStatus: "not_billable", billedAmount: "40.00", estimatedValue: "90.00" }),
    ).toBe(0);
  });

  it("accepts numeric inputs too", () => {
    expect(potentialPerLead({ billableStatus: "billable", billedAmount: 0, estimatedValue: 50 })).toBe(50);
    expect(potentialPerLead({ billableStatus: "billable", billedAmount: 45, estimatedValue: 90 })).toBe(45);
  });
});
