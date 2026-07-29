import { describe, expect, it } from "vitest";

import {
  classifyMomentum,
  evaluateProducingHealth,
  type ProducingHealthInput,
} from "./producing-health";

// Default thresholds mirror the app_settings defaults.
const MIN = 4;
const MONTHS_REQ = 2;

function evaluate(over: Partial<ProducingHealthInput>) {
  return evaluateProducingHealth({
    status: "producing",
    billable30d: 0,
    monthlyBillable: [0, 0, 0],
    minBillableLeads: MIN,
    monthsRequired: MONTHS_REQ,
    hasEverReceivedLead: true, // default: has real history (tests overstated logic)
    ...over,
  });
}

describe("evaluateProducingHealth — derived-producing rule", () => {
  it("is producing when 30d bar AND 2-of-3 months are both met", () => {
    const r = evaluate({ billable30d: 6, monthlyBillable: [5, 4, 6] });
    expect(r.derivedProducing).toBe(true);
    expect(r.qualifyingMonths).toBe(3);
  });

  it("is NOT producing when only 1 of 3 months clears the bar (2-of-3 rule)", () => {
    // Strong 30d but a single lucky month — must not flip the signal.
    const r = evaluate({ billable30d: 9, monthlyBillable: [0, 1, 9] });
    expect(r.qualifyingMonths).toBe(1);
    expect(r.derivedProducing).toBe(false);
  });

  it("is producing with exactly 2 of 3 months clearing the bar", () => {
    const r = evaluate({ billable30d: 5, monthlyBillable: [4, 1, 5] });
    expect(r.qualifyingMonths).toBe(2);
    expect(r.derivedProducing).toBe(true);
  });

  it("is NOT producing when the 30d bar fails even if months are fine", () => {
    const r = evaluate({ billable30d: 3, monthlyBillable: [8, 8, 8] });
    expect(r.derivedProducing).toBe(false);
  });
});

describe("evaluateProducingHealth — boundary at exactly minBillableLeads", () => {
  it("counts a month with exactly MIN as qualifying (>=, not >)", () => {
    const r = evaluate({ billable30d: MIN, monthlyBillable: [MIN, MIN, 0] });
    expect(r.qualifyingMonths).toBe(2);
    expect(r.derivedProducing).toBe(true);
  });

  it("one below MIN does not qualify, in either window", () => {
    const r = evaluate({
      billable30d: MIN - 1,
      monthlyBillable: [MIN - 1, MIN - 1, MIN - 1],
    });
    expect(r.qualifyingMonths).toBe(0);
    expect(r.derivedProducing).toBe(false);
  });

  it("30d exactly at MIN clears the 30d bar", () => {
    const r = evaluate({ billable30d: MIN, monthlyBillable: [MIN, MIN, MIN] });
    expect(r.derivedProducing).toBe(true);
  });
});

describe("evaluateProducingHealth — signal vs manual status", () => {
  it("green match: producing status + data confirms", () => {
    const r = evaluate({ status: "producing", billable30d: 6, monthlyBillable: [5, 5, 6] });
    expect(r.signal).toBe("match");
    expect(r.reason).toBeNull();
  });

  it("green match applies to rented and trial too", () => {
    const base = { billable30d: 6, monthlyBillable: [5, 5, 6] as number[] };
    expect(evaluate({ status: "rented", ...base }).signal).toBe("match");
    expect(evaluate({ status: "trial", ...base }).signal).toBe("match");
  });

  it("amber overstated: producing but weak 30d volume, with N in the reason", () => {
    const r = evaluate({ status: "producing", billable30d: 2, monthlyBillable: [1, 0, 2] });
    expect(r.signal).toBe("overstated");
    expect(r.reason).toContain("2 billable");
    expect(r.reason).toContain("30d");
  });

  it("amber overstated: producing with strong 30d but not sustained across months", () => {
    const r = evaluate({ status: "producing", billable30d: 12, monthlyBillable: [0, 0, 0] });
    expect(r.signal).toBe("overstated");
    expect(r.reason).toContain("not yet sustained");
  });

  it("blue understated: building/optimizing that clears the bar", () => {
    const building = evaluate({ status: "building", billable30d: 8, monthlyBillable: [5, 6, 8] });
    expect(building.signal).toBe("understated");
    expect(building.reason).toContain("ready to sell");
    expect(evaluate({ status: "optimizing", billable30d: 8, monthlyBillable: [5, 6, 8] }).signal).toBe(
      "understated",
    );
  });

  it("neutral: building/optimizing that does NOT clear the bar", () => {
    expect(evaluate({ status: "building", billable30d: 1, monthlyBillable: [0, 1, 1] }).signal).toBe(
      "neutral",
    );
  });

  it("neutral: a never-live property (no ingested lead ever) is NOT overstated", () => {
    // Producing but below the bar — however it has never received a real lead,
    // so it just hasn't started. Suppressed until there's real history.
    const r = evaluate({
      status: "producing",
      billable30d: 0,
      monthlyBillable: [0, 0, 0],
      hasEverReceivedLead: false,
    });
    expect(r.signal).toBe("neutral");
    expect(r.reason).toBeNull();
  });

  it("still overstated once it has real history and then drops below the bar", () => {
    const r = evaluate({
      status: "producing",
      billable30d: 1,
      monthlyBillable: [4, 0, 0],
      hasEverReceivedLead: true,
    });
    expect(r.signal).toBe("overstated");
  });

  it("neutral: rented/trial that fall short are not flagged (assignment-driven)", () => {
    expect(evaluate({ status: "rented", billable30d: 1, monthlyBillable: [0, 0, 1] }).signal).toBe(
      "neutral",
    );
    expect(evaluate({ status: "paused", billable30d: 9, monthlyBillable: [9, 9, 9] }).signal).toBe(
      "neutral",
    );
  });
});

describe("classifyMomentum", () => {
  it("rising: recent clearly above the prior two", () => {
    expect(classifyMomentum([2, 4, 8], MIN)).toBe("rising");
    // From nothing to real volume is rising.
    expect(classifyMomentum([0, 0, 6], MIN)).toBe("rising");
  });

  it("steady: recent within band of the prior average", () => {
    expect(classifyMomentum([5, 5, 5], MIN)).toBe("steady");
    expect(classifyMomentum([6, 4, 5], MIN)).toBe("steady");
  });

  it("falling: recent clearly below the prior two", () => {
    expect(classifyMomentum([8, 8, 2], MIN)).toBe("falling");
    expect(classifyMomentum([10, 6, 3], MIN)).toBe("falling");
  });

  it("none: not enough total volume for a meaningful trend", () => {
    expect(classifyMomentum([0, 0, 0], MIN)).toBe("none");
    expect(classifyMomentum([1, 1, 1], MIN)).toBe("none"); // total 3 < MIN 4
    expect(classifyMomentum([], MIN)).toBe("none");
  });

  it("momentum surfaces on the full evaluate() result", () => {
    expect(evaluate({ monthlyBillable: [2, 4, 8], billable30d: 8 }).momentum).toBe("rising");
    expect(evaluate({ monthlyBillable: [8, 8, 2], billable30d: 2 }).momentum).toBe("falling");
  });
});

describe("evaluateProducingHealth — billable-only by construction", () => {
  // The classifier only ever receives billable counts; spam/non-billable are
  // excluded upstream in SQL. This documents that contract: zero billable leads
  // yields a not-producing verdict regardless of how much junk existed.
  it("zero billable leads is never producing", () => {
    const r = evaluate({ status: "producing", billable30d: 0, monthlyBillable: [0, 0, 0] });
    expect(r.derivedProducing).toBe(false);
    expect(r.signal).toBe("overstated");
  });
});
