import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";

import { todayDateStr, trailingDayRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { leads, properties, propertyAssignments } from "@/lib/db/schema";
import { toMoneyString } from "@/lib/money";
import { getProducingHealthMap } from "@/lib/queries/producing-health";
import { getAppSettings } from "@/lib/settings";

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
 *  - an active trial has passed its trial_ends_on without conversion, OR
 *  - the derived producing-health signal disagrees with the manual status:
 *      · "overstated" — marked producing but billable lead flow doesn't meet
 *        the bar, OR
 *      · "understated" — still building/optimizing but the billable flow DOES
 *        meet the bar (likely ready to sell).
 * The producing-health signal is billable-only (spam/junk excluded) and is the
 * single source of the producing/pre-launch drift reasons; see
 * lib/producing-health.ts. This never mutates status — advisory only.
 */
export async function getReviewFlags(
  tz: string,
): Promise<Map<string, ReviewFlag>> {
  const today = todayDateStr(tz);
  const settings = await getAppSettings();
  const [health, expiredTrials] = await Promise.all([
    getProducingHealthMap(tz, {
      minBillableLeads: settings.producingMinBillableLeads,
      monthsRequired: settings.producingMonthsRequired,
    }),
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

  const flags = new Map<string, ReviewFlag>();

  // Expired trials take priority — they must be resolved.
  for (const t of expiredTrials) {
    flags.set(t.propertyId, {
      badge: "Trial expired",
      reason: `Trial ended ${t.trialEndsOn} without conversion — convert or end it (it still books zero revenue).`,
    });
  }

  // Fold in producing-health mismatches with their specific per-row reason.
  for (const [id, h] of health.map) {
    if (flags.has(id)) continue;
    if (h.health.signal === "overstated") {
      flags.set(id, {
        badge: "Overstated",
        reason: h.health.reason ?? "Marked producing but lead flow is weak.",
      });
    } else if (h.health.signal === "understated") {
      flags.set(id, {
        badge: "Understated",
        reason: h.health.reason ?? "Meets the producing bar but still pre-launch.",
      });
    }
  }

  return flags;
}
