import { sumMoney, toMoneyNumber } from "@/lib/money";

// ---------------------------------------------------------------------------
// Pure assignment math. Everything works in whole org-tz calendar months
// expressed as an integer month index (year*12 + month-1), so there is no
// timezone or Date arithmetic here — callers pass in the current month index.
//
// Proration is never applied: an assignment that overlaps a month at all counts
// that whole month (both its start month and its end month are included).
// ---------------------------------------------------------------------------

export interface AssignmentLite {
  clientId: string;
  clientName?: string | null;
  startedOn: string; // YYYY-MM-DD
  endedOn: string | null; // null = active
  billingType: string;
  monthlyRate: string;
}

/** Integer month index for a "YYYY-MM-DD" date string. */
export function monthIndexFromDate(dateStr: string): number {
  const [y, m] = dateStr.split("-").map(Number);
  return y * 12 + (m - 1);
}

/** Integer month index for a (year, month 1-12) pair. */
export function monthIndexFromYm(year: number, month1to12: number): number {
  return year * 12 + (month1to12 - 1);
}

function chargesFlat(billingType: string): boolean {
  return billingType === "flat_monthly" || billingType === "hybrid";
}

/** The last month index an assignment covers: its end month, or `now` if active. */
function endIndex(a: AssignmentLite, nowIndex: number): number {
  return a.endedOn ? monthIndexFromDate(a.endedOn) : nowIndex;
}

/** Is the assignment active at any point during the given month index? */
export function activeInMonth(
  a: AssignmentLite,
  monthIndex: number,
  nowIndex: number,
): boolean {
  const start = monthIndexFromDate(a.startedOn);
  return start <= monthIndex && monthIndex <= endIndex(a, nowIndex);
}

/**
 * Flat rent booked for a single month: the full monthly_rate of every
 * flat/hybrid assignment active that month (no proration). In a handoff month
 * where two assignments overlap, both full rates count.
 */
export function flatRevenueForMonth(
  assignments: AssignmentLite[],
  monthIndex: number,
  nowIndex: number,
): string {
  return sumMoney(
    assignments
      .filter(
        (a) => chargesFlat(a.billingType) && activeInMonth(a, monthIndex, nowIndex),
      )
      .map((a) => a.monthlyRate),
  );
}

/** Distinct month indices in which the property had ANY active assignment. */
function rentedMonthSet(
  assignments: AssignmentLite[],
  nowIndex: number,
): Set<number> {
  const set = new Set<number>();
  for (const a of assignments) {
    const start = monthIndexFromDate(a.startedOn);
    const end = endIndex(a, nowIndex);
    for (let i = start; i <= end; i++) set.add(i);
  }
  return set;
}

/** Count of distinct calendar months the property was rented (any client). */
export function monthsRented(
  assignments: AssignmentLite[],
  nowIndex: number,
): number {
  return rentedMonthSet(assignments, nowIndex).size;
}

/** Lifetime flat rent across all assignments (full monthly_rate per month). */
export function lifetimeFlatRevenue(
  assignments: AssignmentLite[],
  nowIndex: number,
): string {
  const parts: number[] = [];
  for (const a of assignments) {
    if (!chargesFlat(a.billingType)) continue;
    const months = endIndex(a, nowIndex) - monthIndexFromDate(a.startedOn) + 1;
    parts.push(toMoneyNumber(a.monthlyRate) * Math.max(0, months));
  }
  return sumMoney(parts);
}

/** Per-client tenure in months (union of that client's active months). */
export function tenureMonthsByClient(
  assignments: AssignmentLite[],
  nowIndex: number,
): Map<string, { months: number; clientName: string | null }> {
  const byClient = new Map<string, Set<number>>();
  const names = new Map<string, string | null>();
  for (const a of assignments) {
    const set = byClient.get(a.clientId) ?? new Set<number>();
    const start = monthIndexFromDate(a.startedOn);
    const end = endIndex(a, nowIndex);
    for (let i = start; i <= end; i++) set.add(i);
    byClient.set(a.clientId, set);
    if (a.clientName !== undefined) names.set(a.clientId, a.clientName ?? null);
  }
  const out = new Map<string, { months: number; clientName: string | null }>();
  for (const [clientId, set] of byClient) {
    out.set(clientId, { months: set.size, clientName: names.get(clientId) ?? null });
  }
  return out;
}

export interface LifetimeSummary {
  totalClients: number;
  monthsRented: number;
  averageTenureMonths: number;
  longestTenure: { clientId: string; clientName: string | null; months: number } | null;
  lifetimeFlatRevenue: string;
  /** Denominator for occupancy: months since first assignment or first lead. */
  monthsSinceStart: number;
  /** monthsRented / monthsSinceStart, 0..1 (0 when no history). */
  occupancyRate: number;
}

/**
 * Roll up lifetime tenure/occupancy metrics. `firstLeadMonthIndex` is the month
 * index of the property's earliest lead (or null); occupancy is measured from
 * whichever is earlier: first assignment or first lead.
 */
export function summarizeLifetime(
  assignments: AssignmentLite[],
  nowIndex: number,
  firstLeadMonthIndex: number | null,
): LifetimeSummary {
  const tenures = tenureMonthsByClient(assignments, nowIndex);
  const totalClients = tenures.size;

  let tenureSum = 0;
  let longest: LifetimeSummary["longestTenure"] = null;
  for (const [clientId, { months, clientName }] of tenures) {
    tenureSum += months;
    if (!longest || months > longest.months) {
      longest = { clientId, clientName, months };
    }
  }

  const rented = monthsRented(assignments, nowIndex);

  const startCandidates: number[] = assignments.map((a) =>
    monthIndexFromDate(a.startedOn),
  );
  if (firstLeadMonthIndex !== null) startCandidates.push(firstLeadMonthIndex);
  const earliest =
    startCandidates.length > 0 ? Math.min(...startCandidates) : nowIndex;
  const monthsSinceStart = Math.max(1, nowIndex - earliest + 1);

  return {
    totalClients,
    monthsRented: rented,
    averageTenureMonths: totalClients > 0 ? tenureSum / totalClients : 0,
    longestTenure: longest,
    lifetimeFlatRevenue: lifetimeFlatRevenue(assignments, nowIndex),
    monthsSinceStart,
    occupancyRate: monthsSinceStart > 0 ? rented / monthsSinceStart : 0,
  };
}

/**
 * Revenue-per-month-rented — the comparable earning rate between properties.
 * lifetimeRevenue = lifetime flat rent + SUM(billed_amount). 0 when never rented.
 */
export function revenuePerMonthRented(
  lifetimeRevenue: string | number,
  monthsRentedCount: number,
): number {
  if (monthsRentedCount <= 0) return 0;
  return toMoneyNumber(lifetimeRevenue) / monthsRentedCount;
}
