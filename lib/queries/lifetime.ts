import { and, eq, isNull, sql } from "drizzle-orm";

import {
  flatRevenueForMonth,
  lifetimeFlatRevenue,
  monthIndexFromDate,
  monthIndexFromYm,
  type AssignmentLite,
} from "@/lib/assignments";
import {
  currentMonthIndex,
  daysBetween,
  localMonthExpr,
  monthKey,
  shiftDateStr,
  type MonthKey,
} from "@/lib/dates";
import { db } from "@/lib/db";
import { leads, properties, propertyAssignments } from "@/lib/db/schema";
import { sumMoney, toMoneyNumber, toMoneyString } from "@/lib/money";
import { getAssignmentsMap } from "@/lib/queries/assignments";

// Potential per-lead revenue, in SQL — mirrors lib/potential.ts exactly:
// billable ? (billed_amount > 0 ? billed_amount : estimated_value) : 0.
const potentialSql = sql<string>`coalesce(sum(
  case when ${leads.billableStatus} = 'billable'
    then (case when ${leads.billedAmount} > 0 then ${leads.billedAmount} else ${leads.estimatedValue} end)
    else 0 end
), 0)::text`;

export interface LifetimePropertyRow {
  propertyId: string;
  name: string;
  niche: string | null;
  city: string | null;
  status: string;
  billingType: string;
  totalLeads: number;
  billableLeads: number;
  actualRevenue: string;
  potentialRevenue: string;
  difference: string;
  /** potential / actual, or null when there's no actual revenue. */
  multiple: number | null;
}

export interface LifetimeTrendPoint {
  key: string; // YYYY-MM
  label: string; // "Jul 2026"
  actualRevenue: string;
  potentialRevenue: string;
}

export interface LifetimeRollup {
  headline: {
    totalLeads: number;
    calls: number;
    forms: number;
    billable: number;
    actualRevenue: string;
    potentialRevenue: string;
    difference: string;
    multiple: number | null;
  };
  properties: LifetimePropertyRow[];
  trend: LifetimeTrendPoint[];
}

const aggCalls = sql<number>`(count(*) filter (where ${leads.type} = 'call'))::int`;
const aggForms = sql<number>`(count(*) filter (where ${leads.type} = 'form'))::int`;
const aggBillable = sql<number>`(count(*) filter (where ${leads.billableStatus} = 'billable'))::int`;
const aggBilled = sql<string>`coalesce(sum(${leads.billedAmount}), 0)::text`;

export async function getLifetimeRollup(tz: string): Promise<LifetimeRollup> {
  const nowIndex = currentMonthIndex(tz);
  const monthExpr = localMonthExpr(tz, leads.occurredAt);

  const [props, assignmentsMap, allTime, monthly] = await Promise.all([
    db
      .select({
        id: properties.id,
        name: properties.name,
        niche: properties.niche,
        city: properties.city,
        status: properties.status,
        billingType: properties.billingType,
      })
      .from(properties)
      .where(isNull(properties.deletedAt))
      .orderBy(properties.name),
    getAssignmentsMap(),
    db
      .select({
        propertyId: leads.propertyId,
        total: sql<number>`(count(*))::int`,
        calls: aggCalls,
        forms: aggForms,
        billable: aggBillable,
        billed: aggBilled,
        potential: potentialSql,
      })
      .from(leads)
      .where(isNull(leads.deletedAt))
      .groupBy(leads.propertyId),
    db
      .select({
        propertyId: leads.propertyId,
        month: sql<string>`to_char(${monthExpr}, 'YYYY-MM')`,
        billed: aggBilled,
        potential: potentialSql,
      })
      .from(leads)
      .where(isNull(leads.deletedAt))
      .groupBy(leads.propertyId, monthExpr),
  ]);

  const allTimeByProp = new Map(allTime.map((r) => [r.propertyId, r]));

  // -- Per-property rows --------------------------------------------------
  const rows: LifetimePropertyRow[] = props.map((p) => {
    const agg = allTimeByProp.get(p.id);
    const assignments: AssignmentLite[] = assignmentsMap.get(p.id) ?? [];
    const flatAllTime = lifetimeFlatRevenue(assignments, nowIndex);
    const billed = toMoneyString(agg?.billed ?? "0");
    const actualRevenue = sumMoney([flatAllTime, billed]);
    const potentialRevenue = toMoneyString(agg?.potential ?? "0");
    const difference = sumMoney([
      potentialRevenue,
      -toMoneyNumber(actualRevenue),
    ]);
    const actualNum = toMoneyNumber(actualRevenue);
    return {
      propertyId: p.id,
      name: p.name,
      niche: p.niche,
      city: p.city,
      status: p.status,
      billingType: p.billingType,
      totalLeads: agg?.total ?? 0,
      billableLeads: agg?.billable ?? 0,
      actualRevenue,
      potentialRevenue,
      difference,
      multiple: actualNum > 0 ? toMoneyNumber(potentialRevenue) / actualNum : null,
    };
  });

  // -- Headline totals ----------------------------------------------------
  const totalActual = sumMoney(rows.map((r) => r.actualRevenue));
  const totalPotential = sumMoney(rows.map((r) => r.potentialRevenue));
  const headline = {
    totalLeads: allTime.reduce((s, r) => s + r.total, 0),
    calls: allTime.reduce((s, r) => s + r.calls, 0),
    forms: allTime.reduce((s, r) => s + r.forms, 0),
    billable: allTime.reduce((s, r) => s + r.billable, 0),
    actualRevenue: totalActual,
    potentialRevenue: totalPotential,
    difference: sumMoney([totalPotential, -toMoneyNumber(totalActual)]),
    multiple:
      toMoneyNumber(totalActual) > 0
        ? toMoneyNumber(totalPotential) / toMoneyNumber(totalActual)
        : null,
  };

  // -- Monthly trend (reuses flatRevenueForMonth, matching getMonthlyReport) --
  const billedByPropMonth = new Map<string, { billed: string; potential: string }>();
  let earliestIdx = nowIndex;
  for (const r of monthly) {
    billedByPropMonth.set(`${r.propertyId}|${r.month}`, {
      billed: r.billed,
      potential: r.potential,
    });
    const [y, m] = r.month.split("-").map(Number);
    earliestIdx = Math.min(earliestIdx, monthIndexFromYm(y, m));
  }
  for (const list of assignmentsMap.values()) {
    for (const a of list) {
      earliestIdx = Math.min(earliestIdx, monthIndexFromDate(a.startedOn));
    }
  }

  const trend: LifetimeTrendPoint[] = [];
  for (let idx = earliestIdx; idx <= nowIndex; idx++) {
    const year = Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const mk: MonthKey = monthKey(year, month);

    let flat = 0;
    let billed = 0;
    let potential = 0;
    for (const p of props) {
      const assignments = assignmentsMap.get(p.id) ?? [];
      flat += toMoneyNumber(flatRevenueForMonth(assignments, idx, nowIndex));
      const cell = billedByPropMonth.get(`${p.id}|${key}`);
      if (cell) {
        billed += toMoneyNumber(cell.billed);
        potential += toMoneyNumber(cell.potential);
      }
    }
    trend.push({
      key,
      label: mk.shortLabel,
      actualRevenue: sumMoney([flat, billed]),
      potentialRevenue: toMoneyString(potential),
    });
  }

  return { headline, properties: rows, trend };
}

// ---------------------------------------------------------------------------
// Trial conversion metrics (dashboard Lifetime tab).
// ---------------------------------------------------------------------------

export interface TrialSummary {
  trialsRun: number;
  converted: number;
  /** converted / trials that have concluded (ended), or null when none. */
  conversionRate: number | null;
  avgDaysToConvert: number | null;
  /** Estimated value delivered in ended trials that did NOT convert. */
  estimatedGivenAway: string;
}

export async function getTrialSummary(tz: string): Promise<TrialSummary> {
  const [trials, paidAssignments, estRows] = await Promise.all([
    db
      .select({
        id: propertyAssignments.id,
        propertyId: propertyAssignments.propertyId,
        clientId: propertyAssignments.clientId,
        startedOn: propertyAssignments.startedOn,
        endedOn: propertyAssignments.endedOn,
      })
      .from(propertyAssignments)
      .where(eq(propertyAssignments.isTrial, true)),
    db
      .select({
        propertyId: propertyAssignments.propertyId,
        clientId: propertyAssignments.clientId,
        startedOn: propertyAssignments.startedOn,
      })
      .from(propertyAssignments)
      .where(eq(propertyAssignments.isTrial, false)),
    // Estimated value delivered during each trial (leads stamped with the
    // prospect, within the trial window).
    db
      .select({
        trialId: propertyAssignments.id,
        est: sql<string>`coalesce(sum(${leads.estimatedValue}), 0)::text`,
      })
      .from(propertyAssignments)
      .innerJoin(
        leads,
        and(
          eq(leads.propertyId, propertyAssignments.propertyId),
          eq(leads.clientId, propertyAssignments.clientId),
          isNull(leads.deletedAt),
          sql`${leads.occurredAt} >= (${propertyAssignments.startedOn}::timestamp AT TIME ZONE ${tz})`,
          sql`(${propertyAssignments.endedOn} is null or ${leads.occurredAt} < ((${propertyAssignments.endedOn}::timestamp AT TIME ZONE ${tz}) + interval '1 day'))`,
        ),
      )
      .where(eq(propertyAssignments.isTrial, true))
      .groupBy(propertyAssignments.id),
  ]);

  const estByTrial = new Map(estRows.map((r) => [r.trialId, r.est]));
  const paidKey = new Set(
    paidAssignments.map((p) => `${p.propertyId}|${p.clientId}|${p.startedOn}`),
  );

  let converted = 0;
  let concluded = 0;
  let daysSum = 0;
  const givenAway: string[] = [];

  for (const t of trials) {
    if (t.endedOn === null) continue; // active/expired trials aren't concluded
    concluded++;
    // Converted iff a paid assignment for the same property+client began the
    // day after the trial ended (exactly what convertTrial produces).
    const paidStart = shiftDateStr(t.endedOn, 1);
    const isConverted = paidKey.has(`${t.propertyId}|${t.clientId}|${paidStart}`);
    if (isConverted) {
      converted++;
      daysSum += daysBetween(t.startedOn, paidStart);
    } else {
      givenAway.push(estByTrial.get(t.id) ?? "0");
    }
  }

  return {
    trialsRun: trials.length,
    converted,
    conversionRate: concluded > 0 ? converted / concluded : null,
    avgDaysToConvert: converted > 0 ? daysSum / converted : null,
    estimatedGivenAway: sumMoney(givenAway),
  };
}
