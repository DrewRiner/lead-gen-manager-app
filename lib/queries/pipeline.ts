import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";

import { shiftDateStr, todayDateStr, trailingDayRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { leads, properties, propertyAssignments } from "@/lib/db/schema";
import { toMoneyString } from "@/lib/money";
import { getPropertyRangeCounts } from "@/lib/queries/metrics";

export interface PipelineSummary {
  counts: {
    building: number;
    optimizing: number;
    producing: number;
    trial: number;
    rented: number;
    paused: number;
  };
  /** Leads in the last 30 days across producing properties. */
  producingLeads30d: number;
  /** SUM(target_monthly_rent) across producing properties. */
  producingTargetRent: string;
  /** Current monthly flat revenue from active PAID assignments (trials excluded). */
  rentedMonthlyRevenue: string;
  /** SUM(estimated_value) of leads delivered during active trials. */
  trialEstimatedDelivered: string;
  /** Active trials past their trial_ends_on. */
  expiredTrials: number;
}

export async function getPipelineSummary(
  tz: string,
): Promise<PipelineSummary> {
  const range = trailingDayRange(tz, 30);
  const today = todayDateStr(tz);

  const [countRows, [prodLeads], [prodTarget], [rentedRev], [trialEst], [expired]] =
    await Promise.all([
      db
        .select({ status: properties.status, n: sql<number>`count(*)::int` })
        .from(properties)
        .where(isNull(properties.deletedAt))
        .groupBy(properties.status),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(leads)
        .innerJoin(properties, eq(properties.id, leads.propertyId))
        .where(
          and(
            isNull(leads.deletedAt),
            eq(properties.status, "producing"),
            gte(leads.occurredAt, range.start),
            lt(leads.occurredAt, range.end),
          ),
        ),
      db
        .select({
          total: sql<string>`coalesce(sum(${properties.targetMonthlyRent}), 0)::text`,
        })
        .from(properties)
        .where(and(isNull(properties.deletedAt), eq(properties.status, "producing"))),
      db
        .select({
          total: sql<string>`coalesce(sum(${propertyAssignments.monthlyRate}), 0)::text`,
        })
        .from(propertyAssignments)
        .where(
          and(
            isNull(propertyAssignments.endedOn),
            eq(propertyAssignments.isTrial, false),
            sql`${propertyAssignments.billingType} in ('flat_monthly','hybrid')`,
          ),
        ),
      // Estimated value delivered so far during active trials.
      db
        .select({
          total: sql<string>`coalesce(sum(${leads.estimatedValue}), 0)::text`,
        })
        .from(leads)
        .innerJoin(
          propertyAssignments,
          and(
            eq(propertyAssignments.propertyId, leads.propertyId),
            eq(propertyAssignments.isTrial, true),
            isNull(propertyAssignments.endedOn),
          ),
        )
        .where(
          and(
            isNull(leads.deletedAt),
            sql`${leads.occurredAt} >= (${propertyAssignments.startedOn}::timestamp AT TIME ZONE ${tz})`,
          ),
        ),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(propertyAssignments)
        .where(
          and(
            eq(propertyAssignments.isTrial, true),
            isNull(propertyAssignments.endedOn),
            sql`${propertyAssignments.trialEndsOn} < ${today}`,
          ),
        ),
    ]);

  const counts = { building: 0, optimizing: 0, producing: 0, trial: 0, rented: 0, paused: 0 };
  for (const r of countRows) {
    if (r.status in counts) counts[r.status as keyof typeof counts] = r.n;
  }

  return {
    counts,
    producingLeads30d: prodLeads?.n ?? 0,
    producingTargetRent: toMoneyString(prodTarget?.total ?? "0"),
    rentedMonthlyRevenue: toMoneyString(rentedRev?.total ?? "0"),
    trialEstimatedDelivered: toMoneyString(trialEst?.total ?? "0"),
    expiredTrials: expired?.n ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Status drift: properties whose status looks inconsistent with their activity.
// ---------------------------------------------------------------------------

export interface ReviewFlag {
  /** Short badge text shown on the row. */
  badge: string;
  /** Longer explanation. */
  reason: string;
}

/**
 * A property needs a status review when:
 *  - status is building/optimizing but it had >= 10 leads in the last 30 days
 *  - status is producing but 0 leads in the last 30 days AND launched_on is
 *    more than 90 days ago.
 */
export async function getReviewFlags(
  tz: string,
): Promise<Map<string, ReviewFlag>> {
  const today = todayDateStr(tz);
  const [rows, counts, expiredTrials] = await Promise.all([
    db
      .select({
        id: properties.id,
        status: properties.status,
        launchedOn: properties.launchedOn,
      })
      .from(properties)
      .where(isNull(properties.deletedAt)),
    getPropertyRangeCounts(trailingDayRange(tz, 30)),
    db
      .select({
        propertyId: propertyAssignments.propertyId,
        trialEndsOn: propertyAssignments.trialEndsOn,
      })
      .from(propertyAssignments)
      .where(
        and(
          eq(propertyAssignments.isTrial, true),
          isNull(propertyAssignments.endedOn),
          sql`${propertyAssignments.trialEndsOn} < ${today}`,
        ),
      ),
  ]);

  const cutoff = shiftDateStr(today, -90); // 90 days ago
  const flags = new Map<string, ReviewFlag>();

  // Expired trials take priority — they must be resolved.
  for (const t of expiredTrials) {
    flags.set(t.propertyId, {
      badge: "Trial expired",
      reason: `Trial ended ${t.trialEndsOn} without conversion — convert or end it (it still books zero revenue).`,
    });
  }

  for (const p of rows) {
    if (flags.has(p.id)) continue;
    const leads30d = counts.get(p.id)?.total ?? 0;

    if ((p.status === "building" || p.status === "optimizing") && leads30d >= 10) {
      flags.set(p.id, {
        badge: "10+ leads, pre-launch",
        reason: `${leads30d} leads in 30 days while still ${p.status} — likely ready to move to producing.`,
      });
      continue;
    }

    if (
      p.status === "producing" &&
      leads30d === 0 &&
      p.launchedOn !== null &&
      p.launchedOn < cutoff
    ) {
      flags.set(p.id, {
        badge: "No leads 90d+",
        reason: `Producing but 0 leads in 30 days and launched over 90 days ago (${p.launchedOn}).`,
      });
    }
  }

  return flags;
}
