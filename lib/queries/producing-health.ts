import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";

import {
  localMonthExpr,
  monthRangeUtc,
  recentMonths,
  trailingDayRange,
  type MonthKey,
} from "@/lib/dates";
import { db } from "@/lib/db";
import { leads, properties } from "@/lib/db/schema";
import {
  evaluateProducingHealth,
  type ProducingHealth,
} from "@/lib/producing-health";

// ---------------------------------------------------------------------------
// Loads the billable-only lead counts that drive the producing-health signal
// and runs the pure classifier (lib/producing-health.ts) per property. All
// counting is billable-only in SQL, so spam/non-billable/pending/unmatched are
// excluded by construction. All windows use occurred_at in the org timezone.
// ---------------------------------------------------------------------------

/** COUNT of billable leads. */
const aggBillable = sql<number>`(count(*) filter (where ${leads.billableStatus} = 'billable'))::int`;

/** Webhook-ingested lead sources. A property with none of these has never gone live. */
const INGESTED_SOURCES = ["ghl", "callrail", "twilio"];

/** Property ids that have EVER received a real ingested (webhook) lead. */
async function loadPropertiesWithLeadHistory(): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ propertyId: leads.propertyId })
    .from(leads)
    .where(
      and(
        isNull(leads.deletedAt),
        isNotNull(leads.propertyId),
        inArray(leads.sourceSystem, INGESTED_SOURCES),
      ),
    );
  return new Set(rows.flatMap((r) => (r.propertyId ? [r.propertyId] : [])));
}

export interface ProducingHealthThresholds {
  minBillableLeads: number;
  monthsRequired: number;
}

export interface PropertyProducingHealth {
  billable30d: number;
  /** Billable leads for the 3 complete months in `months`, aligned oldest-first. */
  monthlyBillable: number[];
  health: ProducingHealth;
}

export interface ProducingHealthResult {
  /** The 3 complete calendar months used, oldest first ([m-3, m-2, m-1]). */
  months: MonthKey[];
  map: Map<string, PropertyProducingHealth>;
}

/** The last 3 COMPLETE calendar months (excludes the current partial), oldest first. */
export function completeTrailingMonths(tz: string): MonthKey[] {
  // recentMonths returns [current, m-1, m-2, m-3] most-recent-first.
  const withCurrent = recentMonths(tz, 4);
  const complete = withCurrent.slice(1); // drop current partial month
  return [...complete].sort((a, b) => a.key.localeCompare(b.key)); // oldest first
}

/**
 * Producing-health for every non-deleted property.
 */
export async function getProducingHealthMap(
  tz: string,
  thresholds: ProducingHealthThresholds,
): Promise<ProducingHealthResult> {
  const months = completeTrailingMonths(tz);
  const monthRange = {
    start: monthRangeUtc(tz, months[0].year, months[0].month).start,
    end: monthRangeUtc(tz, months[2].year, months[2].month).end,
  };
  const dayRange = trailingDayRange(tz, 30);
  const monthExpr = localMonthExpr(tz, leads.occurredAt);

  const [props, day30, monthly, withHistory] = await Promise.all([
    db
      .select({ id: properties.id, status: properties.status })
      .from(properties)
      .where(isNull(properties.deletedAt)),
    db
      .select({ propertyId: leads.propertyId, billable: aggBillable })
      .from(leads)
      .where(
        and(
          isNull(leads.deletedAt),
          isNotNull(leads.propertyId),
          gte(leads.occurredAt, dayRange.start),
          lt(leads.occurredAt, dayRange.end),
        ),
      )
      .groupBy(leads.propertyId),
    db
      .select({
        propertyId: leads.propertyId,
        monthKey: sql<string>`to_char(${monthExpr}, 'YYYY-MM')`,
        billable: aggBillable,
      })
      .from(leads)
      .where(
        and(
          isNull(leads.deletedAt),
          isNotNull(leads.propertyId),
          gte(leads.occurredAt, monthRange.start),
          lt(leads.occurredAt, monthRange.end),
        ),
      )
      .groupBy(leads.propertyId, monthExpr),
    loadPropertiesWithLeadHistory(),
  ]);

  const day30ByProperty = new Map(day30.map((r) => [r.propertyId, r.billable]));
  // propertyId -> (month key -> billable count)
  const monthlyByProperty = new Map<string, Map<string, number>>();
  for (const r of monthly) {
    if (r.propertyId == null) continue;
    let inner = monthlyByProperty.get(r.propertyId);
    if (!inner) {
      inner = new Map();
      monthlyByProperty.set(r.propertyId, inner);
    }
    inner.set(r.monthKey, r.billable);
  }

  const map = new Map<string, PropertyProducingHealth>();
  for (const p of props) {
    const billable30d = day30ByProperty.get(p.id) ?? 0;
    const inner = monthlyByProperty.get(p.id);
    const monthlyBillable = months.map((m) => inner?.get(m.key) ?? 0);
    const health = evaluateProducingHealth({
      status: p.status,
      billable30d,
      monthlyBillable,
      minBillableLeads: thresholds.minBillableLeads,
      monthsRequired: thresholds.monthsRequired,
      hasEverReceivedLead: withHistory.has(p.id),
    });
    map.set(p.id, { billable30d, monthlyBillable, health });
  }

  return { months, map };
}

export interface PropertyProducingHealthDetail extends PropertyProducingHealth {
  /** The 3 complete calendar months used, oldest first, aligned to monthlyBillable. */
  months: MonthKey[];
  minBillableLeads: number;
  monthsRequired: number;
}

/**
 * Producing-health for a SINGLE property (used on its detail page). Scoped so a
 * detail page doesn't aggregate every property.
 */
export async function getPropertyProducingHealth(
  tz: string,
  propertyId: string,
  thresholds: ProducingHealthThresholds,
): Promise<PropertyProducingHealthDetail | null> {
  const months = completeTrailingMonths(tz);
  const monthRange = {
    start: monthRangeUtc(tz, months[0].year, months[0].month).start,
    end: monthRangeUtc(tz, months[2].year, months[2].month).end,
  };
  const dayRange = trailingDayRange(tz, 30);
  const monthExpr = localMonthExpr(tz, leads.occurredAt);

  const [propRow, day30, monthly, historyRow] = await Promise.all([
    db
      .select({ status: properties.status })
      .from(properties)
      .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)))
      .limit(1),
    db
      .select({ billable: aggBillable })
      .from(leads)
      .where(
        and(
          isNull(leads.deletedAt),
          eq(leads.propertyId, propertyId),
          gte(leads.occurredAt, dayRange.start),
          lt(leads.occurredAt, dayRange.end),
        ),
      ),
    db
      .select({
        monthKey: sql<string>`to_char(${monthExpr}, 'YYYY-MM')`,
        billable: aggBillable,
      })
      .from(leads)
      .where(
        and(
          isNull(leads.deletedAt),
          eq(leads.propertyId, propertyId),
          gte(leads.occurredAt, monthRange.start),
          lt(leads.occurredAt, monthRange.end),
        ),
      )
      .groupBy(monthExpr),
    db
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(
          isNull(leads.deletedAt),
          eq(leads.propertyId, propertyId),
          inArray(leads.sourceSystem, INGESTED_SOURCES),
        ),
      )
      .limit(1),
  ]);

  if (propRow.length === 0) return null;

  const billable30d = day30[0]?.billable ?? 0;
  const byMonth = new Map(monthly.map((r) => [r.monthKey, r.billable]));
  const monthlyBillable = months.map((m) => byMonth.get(m.key) ?? 0);
  const health = evaluateProducingHealth({
    status: propRow[0].status,
    billable30d,
    monthlyBillable,
    minBillableLeads: thresholds.minBillableLeads,
    monthsRequired: thresholds.monthsRequired,
    hasEverReceivedLead: historyRow.length > 0,
  });

  return {
    billable30d,
    monthlyBillable,
    health,
    months,
    minBillableLeads: thresholds.minBillableLeads,
    monthsRequired: thresholds.monthsRequired,
  };
}
