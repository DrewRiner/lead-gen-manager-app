import {
  activeInMonth,
  flatRevenueForMonth,
  monthIndexFromYm,
  type AssignmentLite,
} from "@/lib/assignments";
import { db } from "@/lib/db";
import { clients, leads, properties } from "@/lib/db/schema";
import { computeLeadEconomics, type LeadEconomics } from "@/lib/lead-economics";
import {
  currentMonthIndex,
  localDateExpr,
  localMonthExpr,
  monthRangeUtc,
  type DateRange,
  type MonthKey,
} from "@/lib/dates";
import { sumMoney, toMoneyNumber, toMoneyString } from "@/lib/money";
import { getAssignmentsMap } from "@/lib/queries/assignments";
import {
  and,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  sql,
  type SQL,
} from "drizzle-orm";

// ---------------------------------------------------------------------------
// Central aggregation. Lead counts and money are ALWAYS derived here via SQL,
// never from denormalized counters. All range filtering uses occurred_at.
// ---------------------------------------------------------------------------

export interface LeadFilterOpts {
  propertyId?: string;
  clientId?: string;
}

function rangeConditions(range: DateRange, opts: LeadFilterOpts = {}): SQL {
  const conds: SQL[] = [
    isNull(leads.deletedAt),
    gte(leads.occurredAt, range.start),
    lt(leads.occurredAt, range.end),
  ];
  if (opts.propertyId) conds.push(eq(leads.propertyId, opts.propertyId));
  if (opts.clientId) conds.push(eq(leads.clientId, opts.clientId));
  return and(...conds)!;
}

// Reusable aggregate SQL fragments.
const aggCalls = sql<number>`(count(*) filter (where ${leads.type} = 'call'))::int`;
const aggForms = sql<number>`(count(*) filter (where ${leads.type} = 'form'))::int`;
const aggTotal = sql<number>`(count(*))::int`;
const aggBillable = sql<number>`(count(*) filter (where ${leads.billableStatus} = 'billable'))::int`;
const aggActualRevenue = sql<string>`coalesce(sum(${leads.billedAmount}), 0)::text`;
const aggEstimatedValue = sql<string>`coalesce(sum(${leads.estimatedValue}), 0)::text`;

export interface RangeMetrics {
  totalLeads: number;
  calls: number;
  forms: number;
  billable: number;
  /** SUM(billed_amount) — per-lead charges only (dashboard definition). */
  actualRevenue: string;
  /** SUM(estimated_value) — market value of billable leads. */
  estimatedValue: string;
}

const EMPTY_METRICS: RangeMetrics = {
  totalLeads: 0,
  calls: 0,
  forms: 0,
  billable: 0,
  actualRevenue: "0.00",
  estimatedValue: "0.00",
};

/** Aggregate metrics for a UTC range, optionally scoped to a property/client. */
export async function getRangeMetrics(
  range: DateRange,
  opts: LeadFilterOpts = {},
): Promise<RangeMetrics> {
  const [row] = await db
    .select({
      totalLeads: aggTotal,
      calls: aggCalls,
      forms: aggForms,
      billable: aggBillable,
      actualRevenue: aggActualRevenue,
      estimatedValue: aggEstimatedValue,
    })
    .from(leads)
    .where(rangeConditions(range, opts));

  if (!row) return EMPTY_METRICS;
  return {
    totalLeads: row.totalLeads,
    calls: row.calls,
    forms: row.forms,
    billable: row.billable,
    actualRevenue: toMoneyString(row.actualRevenue),
    estimatedValue: toMoneyString(row.estimatedValue),
  };
}

/** Percent change helper. Returns null when the base period is empty. */
export function percentChange(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

// ---------------------------------------------------------------------------
// Daily volume (chart) — per org-local calendar day.
// ---------------------------------------------------------------------------

export interface DailyVolumeRow {
  day: string; // YYYY-MM-DD (org tz)
  calls: number;
  forms: number;
}

export async function getDailyVolume(
  tz: string,
  range: DateRange,
  opts: LeadFilterOpts = {},
): Promise<DailyVolumeRow[]> {
  const dayExpr = localDateExpr(tz, leads.occurredAt);
  const rows = await db
    .select({
      day: sql<string>`to_char(${dayExpr}, 'YYYY-MM-DD')`,
      calls: aggCalls,
      forms: aggForms,
    })
    .from(leads)
    .where(rangeConditions(range, opts))
    .groupBy(dayExpr)
    .orderBy(dayExpr);
  return rows;
}

// ---------------------------------------------------------------------------
// Top performing properties (dashboard) — per property over a range.
// ---------------------------------------------------------------------------

export interface PropertyPerformanceRow {
  propertyId: string;
  name: string;
  niche: string | null;
  city: string | null;
  state: string | null;
  clientName: string | null;
  calls: number;
  forms: number;
  total: number;
  billable: number;
  estimatedValue: string;
  actualRevenue: string;
}

export async function getTopProperties(
  tz: string,
  range: DateRange,
  limit = 25,
): Promise<PropertyPerformanceRow[]> {
  void tz;
  const rows = await db
    .select({
      propertyId: properties.id,
      name: properties.name,
      niche: properties.niche,
      city: properties.city,
      state: properties.state,
      clientName: clients.businessName,
      calls: aggCalls,
      forms: aggForms,
      total: aggTotal,
      billable: aggBillable,
      estimatedValue: aggEstimatedValue,
      actualRevenue: aggActualRevenue,
    })
    .from(leads)
    .innerJoin(properties, eq(properties.id, leads.propertyId))
    .leftJoin(clients, eq(clients.id, properties.clientId))
    .where(
      and(
        isNull(leads.deletedAt),
        isNull(properties.deletedAt),
        gte(leads.occurredAt, range.start),
        lt(leads.occurredAt, range.end),
      ),
    )
    .groupBy(properties.id, clients.businessName)
    .orderBy(desc(sql`sum(${leads.estimatedValue})`))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    estimatedValue: toMoneyString(r.estimatedValue),
    actualRevenue: toMoneyString(r.actualRevenue),
  }));
}

// ---------------------------------------------------------------------------
// Monthly report — every property for a calendar month.
//
// Actual revenue rules (Phase 1, no rental history table):
//  - "rented that month" is approximated by the property CURRENTLY having a
//    client assigned (client_id is not null).
//  - flat_monthly / hybrid rented: add the full monthly_rate (no proration).
//  - per-lead charges (per_lead / hybrid) come from SUM(billed_amount).
//  - gap = estimated_value - actual_revenue.
// ---------------------------------------------------------------------------

export interface MonthlyReportRow {
  propertyId: string;
  name: string;
  niche: string | null;
  city: string | null;
  state: string | null;
  status: string;
  billingType: string;
  clientName: string | null;
  isRented: boolean;
  calls: number;
  forms: number;
  total: number;
  billable: number;
  estimatedValue: string;
  actualRevenue: string;
  gap: string;
  /** Lead-value economics for this property-month (see lib/lead-economics). */
  economics: LeadEconomics;
}

export interface MonthlyReportTotals {
  totalLeads: number;
  calls: number;
  forms: number;
  billable: number;
  estimatedValue: string;
  actualRevenue: string;
  gap: string;
}

export interface MonthlyReport {
  month: MonthKey;
  rows: MonthlyReportRow[];
  totals: MonthlyReportTotals;
}

export async function getMonthlyReport(
  tz: string,
  month: MonthKey,
): Promise<MonthlyReport> {
  const range = monthRangeUtc(tz, month.year, month.month);
  const monthIndex = monthIndexFromYm(month.year, month.month);
  const nowIndex = currentMonthIndex(tz);

  // All non-deleted properties, per-month lead aggregates, and every
  // assignment (flat revenue for the month comes from assignments active
  // during it, not the property's current rate or "does it have a client now").
  const [props, aggRows, assignmentsMap] = await Promise.all([
    db
      .select({
        propertyId: properties.id,
        name: properties.name,
        niche: properties.niche,
        city: properties.city,
        state: properties.state,
        status: properties.status,
        billingType: properties.billingType,
        monthlyRate: properties.monthlyRate,
        estimatedCallValue: properties.estimatedCallValue,
        estimatedFormValue: properties.estimatedFormValue,
        clientId: properties.clientId,
        clientName: clients.businessName,
      })
      .from(properties)
      .leftJoin(clients, eq(clients.id, properties.clientId))
      .where(isNull(properties.deletedAt))
      .orderBy(properties.name),
    db
      .select({
        propertyId: leads.propertyId,
        calls: aggCalls,
        forms: aggForms,
        total: aggTotal,
        billable: aggBillable,
        estimatedValue: aggEstimatedValue,
        perLeadBilled: aggActualRevenue,
      })
      .from(leads)
      .where(rangeConditions(range))
      .groupBy(leads.propertyId),
    getAssignmentsMap(),
  ]);

  const aggByProperty = new Map(aggRows.map((r) => [r.propertyId, r]));

  const rows: MonthlyReportRow[] = props.map((p) => {
    const agg = aggByProperty.get(p.propertyId);
    const isRented = p.clientId != null;
    const estimatedValue = toMoneyString(agg?.estimatedValue ?? "0");
    const perLeadBilled = toMoneyString(agg?.perLeadBilled ?? "0");
    const assignments: AssignmentLite[] = assignmentsMap.get(p.propertyId) ?? [];
    const flat = flatRevenueForMonth(assignments, monthIndex, nowIndex);
    const actualRevenue = sumMoney([flat, perLeadBilled]);
    const gap = sumMoney([estimatedValue, -toMoneyNumber(actualRevenue)]);
    const calls = agg?.calls ?? 0;
    const forms = agg?.forms ?? 0;
    const billable = agg?.billable ?? 0;
    const economics = computeLeadEconomics({
      billingType: p.billingType,
      hasActiveAssignment: assignments.some((a) =>
        activeInMonth(a, monthIndex, nowIndex),
      ),
      billableLeads: billable,
      flatBookedThisMonth: flat,
      perLeadBilledThisMonth: perLeadBilled,
      estimatedCallValue: p.estimatedCallValue,
      estimatedFormValue: p.estimatedFormValue,
      calls,
      forms,
    });
    return {
      propertyId: p.propertyId,
      name: p.name,
      niche: p.niche,
      city: p.city,
      state: p.state,
      status: p.status,
      billingType: p.billingType,
      clientName: p.clientName,
      isRented,
      calls,
      forms,
      total: agg?.total ?? 0,
      billable,
      estimatedValue,
      actualRevenue,
      gap,
      economics,
    };
  });

  const totals: MonthlyReportTotals = {
    totalLeads: rows.reduce((s, r) => s + r.total, 0),
    calls: rows.reduce((s, r) => s + r.calls, 0),
    forms: rows.reduce((s, r) => s + r.forms, 0),
    billable: rows.reduce((s, r) => s + r.billable, 0),
    estimatedValue: sumMoney(rows.map((r) => r.estimatedValue)),
    actualRevenue: sumMoney(rows.map((r) => r.actualRevenue)),
    gap: sumMoney(rows.map((r) => r.gap)),
  };

  return { month, rows, totals };
}

// ---------------------------------------------------------------------------
// Property monthly series (last 12 calendar months) for the property detail.
// ---------------------------------------------------------------------------

export interface PropertyMonthRow {
  month: MonthKey;
  calls: number;
  forms: number;
  total: number;
  billable: number;
  estimatedValue: string;
  actualRevenue: string;
  gap: string;
}

export async function getPropertyMonthlySeries(
  tz: string,
  propertyId: string,
  months: MonthKey[],
): Promise<PropertyMonthRow[]> {
  if (months.length === 0) return [];

  // Oldest month start -> newest month end.
  const sorted = [...months].sort((a, b) => a.key.localeCompare(b.key));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const range: DateRange = {
    start: monthRangeUtc(tz, first.year, first.month).start,
    end: monthRangeUtc(tz, last.year, last.month).end,
  };
  const nowIndex = currentMonthIndex(tz);

  const monthExpr = localMonthExpr(tz, leads.occurredAt);
  const [aggRows, assignmentsMap] = await Promise.all([
    db
      .select({
        monthDate: sql<string>`to_char(${monthExpr}, 'YYYY-MM')`,
        calls: aggCalls,
        forms: aggForms,
        total: aggTotal,
        billable: aggBillable,
        estimatedValue: aggEstimatedValue,
        perLeadBilled: aggActualRevenue,
      })
      .from(leads)
      .where(rangeConditions(range, { propertyId }))
      .groupBy(monthExpr)
      .orderBy(monthExpr),
    getAssignmentsMap([propertyId]),
  ]);

  const byMonth = new Map(aggRows.map((r) => [r.monthDate, r]));
  const assignments: AssignmentLite[] = assignmentsMap.get(propertyId) ?? [];

  return sorted.map((m) => {
    const agg = byMonth.get(m.key);
    const estimatedValue = toMoneyString(agg?.estimatedValue ?? "0");
    const perLeadBilled = toMoneyString(agg?.perLeadBilled ?? "0");
    const flat = flatRevenueForMonth(
      assignments,
      monthIndexFromYm(m.year, m.month),
      nowIndex,
    );
    const actualRevenue = sumMoney([flat, perLeadBilled]);
    const gap = sumMoney([estimatedValue, -toMoneyNumber(actualRevenue)]);
    return {
      month: m,
      calls: agg?.calls ?? 0,
      forms: agg?.forms ?? 0,
      total: agg?.total ?? 0,
      billable: agg?.billable ?? 0,
      estimatedValue,
      actualRevenue,
      gap,
    };
  });
}

// ---------------------------------------------------------------------------
// Per-property lead counts for a range (used on list pages).
// Returns a map of propertyId -> { total, estimatedValue }.
// ---------------------------------------------------------------------------

export async function getPropertyRangeCounts(
  range: DateRange,
): Promise<Map<string, { total: number; estimatedValue: string }>> {
  const rows = await db
    .select({
      propertyId: leads.propertyId,
      total: aggTotal,
      estimatedValue: aggEstimatedValue,
    })
    .from(leads)
    // Unmatched leads (null property) are never attributed to a property.
    .where(and(rangeConditions(range), isNotNull(leads.propertyId)))
    .groupBy(leads.propertyId);
  return new Map(
    rows.flatMap((r) =>
      r.propertyId == null
        ? []
        : [
            [
              r.propertyId,
              { total: r.total, estimatedValue: toMoneyString(r.estimatedValue) },
            ] as const,
          ],
    ),
  );
}

// ---------------------------------------------------------------------------
// Lead-value economics (effective $/lead + market $/lead) — see
// lib/lead-economics. Both use calendar-month figures in the org timezone,
// consistent with the monthly revenue logic.
// ---------------------------------------------------------------------------

/** Economics for every property for a calendar month (list pages). */
export async function getPropertyEconomicsMap(
  tz: string,
  month: MonthKey,
): Promise<Map<string, LeadEconomics>> {
  const report = await getMonthlyReport(tz, month);
  return new Map(report.rows.map((r) => [r.propertyId, r.economics]));
}

/** Economics for a single property for a calendar month (detail page). */
export async function getPropertyEconomics(
  tz: string,
  propertyId: string,
  month: MonthKey,
): Promise<{ economics: LeadEconomics; billable: number }> {
  const range = monthRangeUtc(tz, month.year, month.month);
  const monthIndex = monthIndexFromYm(month.year, month.month);
  const nowIndex = currentMonthIndex(tz);

  const [propRows, aggRows, assignmentsMap] = await Promise.all([
    db
      .select({
        billingType: properties.billingType,
        estimatedCallValue: properties.estimatedCallValue,
        estimatedFormValue: properties.estimatedFormValue,
      })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1),
    db
      .select({
        calls: aggCalls,
        forms: aggForms,
        billable: aggBillable,
        perLeadBilled: aggActualRevenue,
      })
      .from(leads)
      .where(rangeConditions(range, { propertyId })),
    getAssignmentsMap([propertyId]),
  ]);

  const prop = propRows[0];
  const agg = aggRows[0];
  const assignments: AssignmentLite[] = assignmentsMap.get(propertyId) ?? [];
  const flat = flatRevenueForMonth(assignments, monthIndex, nowIndex);

  const economics = computeLeadEconomics({
    billingType: prop?.billingType ?? "flat_monthly",
    hasActiveAssignment: assignments.some((a) =>
      activeInMonth(a, monthIndex, nowIndex),
    ),
    billableLeads: agg?.billable ?? 0,
    flatBookedThisMonth: flat,
    perLeadBilledThisMonth: agg?.perLeadBilled ?? "0",
    estimatedCallValue: prop?.estimatedCallValue,
    estimatedFormValue: prop?.estimatedFormValue,
    calls: agg?.calls ?? 0,
    forms: agg?.forms ?? 0,
  });

  return { economics, billable: agg?.billable ?? 0 };
}

// ---------------------------------------------------------------------------
// Niche rate card — the going market lead value per industry, aggregated from
// the estimated values of the properties in each niche.
// ---------------------------------------------------------------------------

export interface NicheRateCardRow {
  niche: string;
  propertyCount: number;
  callAvg: string;
  callMin: string;
  callMax: string;
  formAvg: string;
  formMin: string;
  formMax: string;
  /** True when properties in the niche disagree on the rate (show a range). */
  callVaries: boolean;
  formVaries: boolean;
}

export async function getNicheRateCard(): Promise<NicheRateCardRow[]> {
  const rows = await db
    .select({
      niche: properties.niche,
      n: sql<number>`count(*)::int`,
      callAvg: sql<string>`avg(${properties.estimatedCallValue})::text`,
      callMin: sql<string>`min(${properties.estimatedCallValue})::text`,
      callMax: sql<string>`max(${properties.estimatedCallValue})::text`,
      formAvg: sql<string>`avg(${properties.estimatedFormValue})::text`,
      formMin: sql<string>`min(${properties.estimatedFormValue})::text`,
      formMax: sql<string>`max(${properties.estimatedFormValue})::text`,
    })
    .from(properties)
    .where(and(isNull(properties.deletedAt), isNotNull(properties.niche)))
    .groupBy(properties.niche)
    .orderBy(properties.niche);

  return rows
    .filter((r): r is typeof r & { niche: string } => !!r.niche)
    .map((r) => ({
      niche: r.niche,
      propertyCount: r.n,
      callAvg: toMoneyString(r.callAvg),
      callMin: toMoneyString(r.callMin),
      callMax: toMoneyString(r.callMax),
      formAvg: toMoneyString(r.formAvg),
      formMin: toMoneyString(r.formMin),
      formMax: toMoneyString(r.formMax),
      callVaries: toMoneyNumber(r.callMin) !== toMoneyNumber(r.callMax),
      formVaries: toMoneyNumber(r.formMin) !== toMoneyNumber(r.formMax),
    }));
}

/** Per-client lead totals for a range: clientId -> total leads. */
export async function getClientRangeCounts(
  range: DateRange,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      clientId: leads.clientId,
      total: aggTotal,
    })
    .from(leads)
    .where(rangeConditions(range))
    .groupBy(leads.clientId);
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.clientId) map.set(r.clientId, r.total);
  }
  return map;
}
