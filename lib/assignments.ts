import { sumMoney, toMoneyNumber, toMoneyString } from "@/lib/money";

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
  /** A free trial books zero revenue and does not count as a rented month. */
  isTrial?: boolean;
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

/** A trial books no revenue; a paid flat/hybrid assignment charges flat rent. */
function chargesFlatRent(a: AssignmentLite): boolean {
  return !a.isTrial && chargesFlat(a.billingType);
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

/** The last calendar day of a month index, as a "YYYY-MM-DD" string. */
function lastDayOfMonth(monthIndex: number): string {
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1; // 1-12
  const day = new Date(year, month, 0).getDate(); // day 0 of next month
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Is the assignment active on a specific calendar date? (ended_on inclusive) */
export function activeOnDate(a: AssignmentLite, dateStr: string): boolean {
  return a.startedOn <= dateStr && (a.endedOn === null || a.endedOn >= dateStr);
}

/**
 * Flat rent booked for a single month: the full monthly_rate of the ONE
 * flat/hybrid assignment active on the LAST day of the month (no proration).
 * In a handoff month, the outgoing assignment (which ended before month-end)
 * books nothing for its final partial month; only the assignment still active
 * on the last day books. Months beyond `nowIndex` book nothing.
 */
export function flatRevenueForMonth(
  assignments: AssignmentLite[],
  monthIndex: number,
  nowIndex: number,
): string {
  if (monthIndex > nowIndex) return "0.00";
  const lastDay = lastDayOfMonth(monthIndex);
  const covering = assignments.filter(
    (a) => chargesFlatRent(a) && activeOnDate(a, lastDay),
  );
  if (covering.length === 0) return "0.00";
  // At most one assignment is active on any given day; if the data somehow
  // overlaps, the incoming (latest-started) assignment wins.
  covering.sort((x, y) => x.startedOn.localeCompare(y.startedOn));
  return toMoneyString(covering[covering.length - 1].monthlyRate);
}

/** Distinct month indices the property was PAID-rented (trials excluded). */
function rentedMonthSet(
  assignments: AssignmentLite[],
  nowIndex: number,
): Set<number> {
  const set = new Set<number>();
  for (const a of assignments) {
    if (a.isTrial) continue; // trials are free, not rented months
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

/**
 * Lifetime flat rent, summed month-by-month using the same "active on the last
 * day" rule as the monthly reports. This keeps lifetime totals consistent with
 * the sum of monthly figures — a handoff month is booked once (to the incoming
 * assignment), and an outgoing assignment's final partial month books nothing.
 */
export function lifetimeFlatRevenue(
  assignments: AssignmentLite[],
  nowIndex: number,
): string {
  if (!assignments.some((a) => chargesFlatRent(a))) return "0.00";
  const startIdx = Math.min(
    ...assignments.map((a) => monthIndexFromDate(a.startedOn)),
  );
  const parts: string[] = [];
  for (let mi = startIdx; mi <= nowIndex; mi++) {
    parts.push(flatRevenueForMonth(assignments, mi, nowIndex));
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

/**
 * Trial-conversion dates: the new paid assignment starts on `paidStartedOn`,
 * and the trial it converts from ends the day before (so paid begins the day
 * after the trial ended — CLAUDE.md free-trial rule 6). Both records persist.
 */
export function trialConversionDates(paidStartedOn: string): {
  trialEndedOn: string;
  paidStartedOn: string;
} {
  const [y, m, d] = paidStartedOn.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const trialEndedOn = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  return { trialEndedOn, paidStartedOn };
}
