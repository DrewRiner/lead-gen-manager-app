import { describe, expect, it } from "vitest";

import { evaluateLead } from "./billing/evaluate-lead";
import {
  activeInMonth,
  flatRevenueForMonth,
  lifetimeFlatRevenue,
  monthIndexFromYm,
  monthsRented,
  revenuePerMonthRented,
  summarizeLifetime,
  trialConversionDates,
  type AssignmentLite,
} from "./assignments";

const NOW = monthIndexFromYm(2026, 7); // July 2026

function a(partial: Partial<AssignmentLite>): AssignmentLite {
  return {
    clientId: "c1",
    clientName: "Client One",
    startedOn: "2026-01-15",
    endedOn: null,
    billingType: "flat_monthly",
    monthlyRate: "1000.00",
    ...partial,
  };
}

describe("activeInMonth", () => {
  it("counts the start month even when started mid-month (no proration)", () => {
    const asg = a({ startedOn: "2026-03-20", endedOn: null });
    expect(activeInMonth(asg, monthIndexFromYm(2026, 3), NOW)).toBe(true);
    expect(activeInMonth(asg, monthIndexFromYm(2026, 2), NOW)).toBe(false);
  });

  it("counts the end month even when ended mid-month", () => {
    const asg = a({ startedOn: "2026-01-01", endedOn: "2026-04-10" });
    expect(activeInMonth(asg, monthIndexFromYm(2026, 4), NOW)).toBe(true);
    expect(activeInMonth(asg, monthIndexFromYm(2026, 5), NOW)).toBe(false);
  });

  it("an active (null ended_on) assignment covers up to now", () => {
    const asg = a({ startedOn: "2026-01-01", endedOn: null });
    expect(activeInMonth(asg, NOW, NOW)).toBe(true);
    expect(activeInMonth(asg, monthIndexFromYm(2026, 8), NOW)).toBe(false);
  });
});

describe("flatRevenueForMonth", () => {
  it("flat_monthly books full rate in an active month", () => {
    const asgs = [a({ monthlyRate: "1500.00" })];
    expect(flatRevenueForMonth(asgs, monthIndexFromYm(2026, 3), NOW)).toBe("1500.00");
  });

  it("per_lead assignment contributes no flat rent", () => {
    const asgs = [a({ billingType: "per_lead", monthlyRate: "0.00" })];
    expect(flatRevenueForMonth(asgs, monthIndexFromYm(2026, 3), NOW)).toBe("0.00");
  });

  it("hybrid contributes its monthly_rate as flat rent", () => {
    const asgs = [a({ billingType: "hybrid", monthlyRate: "900.00" })];
    expect(flatRevenueForMonth(asgs, monthIndexFromYm(2026, 3), NOW)).toBe("900.00");
  });

  it("handoff month books only the assignment active on the LAST day", () => {
    const asgs = [
      // Outgoing: ends mid-March.
      a({ clientId: "c1", startedOn: "2026-01-01", endedOn: "2026-03-10", monthlyRate: "1000.00" }),
      // Incoming: starts mid-March, still active.
      a({ clientId: "c2", startedOn: "2026-03-15", endedOn: null, monthlyRate: "1200.00" }),
    ];
    // March: only c2 is active on Mar 31 -> 1200 (not 2200).
    expect(flatRevenueForMonth(asgs, monthIndexFromYm(2026, 3), NOW)).toBe("1200.00");
    // February: only c1.
    expect(flatRevenueForMonth(asgs, monthIndexFromYm(2026, 2), NOW)).toBe("1000.00");
    // April: only c2.
    expect(flatRevenueForMonth(asgs, monthIndexFromYm(2026, 4), NOW)).toBe("1200.00");
  });

  it("outgoing assignment books zero for its final partial month", () => {
    // c1 alone, ending mid-March -> March is a partial final month.
    const asgs = [
      a({ clientId: "c1", startedOn: "2026-01-01", endedOn: "2026-03-10", monthlyRate: "1000.00" }),
    ];
    expect(flatRevenueForMonth(asgs, monthIndexFromYm(2026, 2), NOW)).toBe("1000.00");
    expect(flatRevenueForMonth(asgs, monthIndexFromYm(2026, 3), NOW)).toBe("0.00");
  });

  it("an assignment ending on the last day of the month still books that month", () => {
    const asgs = [
      a({ clientId: "c1", startedOn: "2026-01-01", endedOn: "2026-04-30", monthlyRate: "1000.00" }),
    ];
    // Ended exactly on Apr 30 -> active on the last day -> booked.
    expect(flatRevenueForMonth(asgs, monthIndexFromYm(2026, 4), NOW)).toBe("1000.00");
    // May: gone.
    expect(flatRevenueForMonth(asgs, monthIndexFromYm(2026, 5), NOW)).toBe("0.00");
  });
});

describe("monthsRented + lifetimeFlatRevenue", () => {
  it("unions overlapping months so a handoff month is not double-counted", () => {
    const asgs = [
      a({ clientId: "c1", startedOn: "2026-01-01", endedOn: "2026-03-10" }),
      a({ clientId: "c2", startedOn: "2026-03-15", endedOn: "2026-05-20" }),
    ];
    // Jan,Feb,Mar (c1) ∪ Mar,Apr,May (c2) = Jan..May = 5 distinct months.
    expect(monthsRented(asgs, NOW)).toBe(5);
  });

  it("lifetime flat revenue books a handoff month once (to the incoming client)", () => {
    const asgs = [
      // Outgoing: Jan 1 – Mar 10. Books Jan, Feb (Mar is its partial final month).
      a({ startedOn: "2026-01-01", endedOn: "2026-03-10", monthlyRate: "1000.00" }),
      // Incoming: Mar 15 – May 20. Books Mar, Apr (May is its partial final month).
      a({ clientId: "c2", startedOn: "2026-03-15", endedOn: "2026-05-20", monthlyRate: "1500.00" }),
    ];
    // Jan 1000 + Feb 1000 + Mar 1500 + Apr 1500 + May 0 = 5000
    expect(lifetimeFlatRevenue(asgs, NOW)).toBe("5000.00");
  });

  it("active assignment accrues through the current month", () => {
    const asgs = [a({ startedOn: "2026-05-01", endedOn: null, monthlyRate: "1000.00" })];
    // May, Jun, Jul (now) = 3 months
    expect(lifetimeFlatRevenue(asgs, NOW)).toBe("3000.00");
  });
});

describe("summarizeLifetime", () => {
  it("computes clients, tenure, longest, occupancy", () => {
    const asgs = [
      a({ clientId: "c1", clientName: "Anchor", startedOn: "2026-01-01", endedOn: "2026-04-30", monthlyRate: "1000.00" }), // Jan-Apr = 4
      a({ clientId: "c2", clientName: "Short", startedOn: "2026-05-01", endedOn: "2026-05-31", monthlyRate: "1000.00" }), // May = 1
    ];
    const s = summarizeLifetime(asgs, NOW, monthIndexFromYm(2026, 1));
    expect(s.totalClients).toBe(2);
    expect(s.monthsRented).toBe(5); // Jan..May
    expect(s.averageTenureMonths).toBe(2.5); // (4 + 1) / 2
    expect(s.longestTenure?.clientName).toBe("Anchor");
    expect(s.longestTenure?.months).toBe(4);
    // First lead/assignment = Jan (idx), now = Jul => 7 months since start.
    expect(s.monthsSinceStart).toBe(7);
    expect(s.occupancyRate).toBeCloseTo(5 / 7, 5);
  });

  it("handles a property never rented", () => {
    const s = summarizeLifetime([], NOW, monthIndexFromYm(2026, 6));
    expect(s.totalClients).toBe(0);
    expect(s.monthsRented).toBe(0);
    expect(s.averageTenureMonths).toBe(0);
    expect(s.longestTenure).toBeNull();
    expect(s.occupancyRate).toBe(0);
  });
});

describe("free trials", () => {
  it("a trial assignment books zero flat revenue", () => {
    const trial = a({
      startedOn: "2026-01-01",
      endedOn: null,
      monthlyRate: "1500.00",
      isTrial: true,
    });
    expect(flatRevenueForMonth([trial], monthIndexFromYm(2026, 3), NOW)).toBe("0.00");
    expect(lifetimeFlatRevenue([trial], NOW)).toBe("0.00");
  });

  it("an expired trial (past its end date, still active) still books zero", () => {
    // is_trial alone forces zero; trial_ends_on is not part of the flat calc,
    // so an unresolved/expired trial never silently becomes a paid rental.
    const expired = a({
      startedOn: "2026-01-01",
      endedOn: null,
      monthlyRate: "1500.00",
      isTrial: true,
    });
    expect(flatRevenueForMonth([expired], monthIndexFromYm(2026, 5), NOW)).toBe("0.00");
    // ...and a trial is never counted as a rented month.
    expect(monthsRented([expired], NOW)).toBe(0);
  });

  it("conversion produces two linked assignments with correct dates", () => {
    // Paid begins on the given date; the trial ends the day before.
    const { trialEndedOn, paidStartedOn } = trialConversionDates("2026-03-01");
    expect(paidStartedOn).toBe("2026-03-01");
    expect(trialEndedOn).toBe("2026-02-28");
    // leap year
    expect(trialConversionDates("2024-03-01").trialEndedOn).toBe("2024-02-29");
  });

  it("estimated value accrues normally during a trial (billed 0, estimated market)", () => {
    // A property on trial is billed as flat_monthly at $0, so the lead's per-lead
    // billed_amount is 0 but its estimated market value still books.
    const dec = evaluateLead(
      { type: "form", callDurationSeconds: null },
      {
        billingType: "flat_monthly",
        perLeadCallRate: "0",
        perLeadFormRate: "0",
        estimatedCallValue: "80.00",
        estimatedFormValue: "60.00",
        billableThresholdSeconds: 60,
      },
    );
    expect(dec.billedAmount).toBe("0.00");
    expect(dec.estimatedValue).toBe("60.00");
  });
});

describe("revenuePerMonthRented", () => {
  it("divides lifetime revenue by months rented", () => {
    expect(revenuePerMonthRented("12000.00", 6)).toBe(2000);
  });
  it("is 0 when never rented", () => {
    expect(revenuePerMonthRented("5000.00", 0)).toBe(0);
  });
  it("ranks a short high-earner above a long low-earner", () => {
    const shortHigh = revenuePerMonthRented("12000.00", 6); // 2000/mo
    const longLow = revenuePerMonthRented("18000.00", 36); // 500/mo
    expect(shortHigh).toBeGreaterThan(longLow);
  });
});
