import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";

import { trailingDayRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { leads, properties, propertyAssignments } from "@/lib/db/schema";
import { toMoneyString } from "@/lib/money";

// Dashboard pipeline strip, simplified to three states derived from the
// assignment (via the status enum, which follows the assignment):
//   • Rented     — active non-trial assignment; shows current monthly revenue
//   • Trial      — active trial assignment
//   • Not rented — everything else; shows 30-day lead volume + total target rent
// The building/optimizing/producing distinctions are no longer surfaced.

export interface PipelineSummary {
  rented: { count: number; monthlyRevenue: string };
  trial: { count: number };
  notRented: { count: number; leads30d: number; targetRent: string };
}

const NOT_RENTED = sql`${properties.status} not in ('rented','trial')`;

export async function getPipelineSummary(tz: string): Promise<PipelineSummary> {
  const range = trailingDayRange(tz, 30);

  const [countRows, [rentedRev], [notRentedLeads], [notRentedTarget]] =
    await Promise.all([
      db
        .select({ status: properties.status, n: sql<number>`count(*)::int` })
        .from(properties)
        .where(isNull(properties.deletedAt))
        .groupBy(properties.status),
      // Current monthly flat revenue from active PAID assignments (trials excluded).
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
      // 30-day lead volume across not-rented properties.
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(leads)
        .innerJoin(properties, eq(properties.id, leads.propertyId))
        .where(
          and(
            isNull(leads.deletedAt),
            isNull(properties.deletedAt),
            NOT_RENTED,
            gte(leads.occurredAt, range.start),
            lt(leads.occurredAt, range.end),
          ),
        ),
      // Total target rent across not-rented properties.
      db
        .select({
          total: sql<string>`coalesce(sum(${properties.targetMonthlyRent}), 0)::text`,
        })
        .from(properties)
        .where(and(isNull(properties.deletedAt), NOT_RENTED)),
    ]);

  let rented = 0;
  let trial = 0;
  let total = 0;
  for (const r of countRows) {
    total += r.n;
    if (r.status === "rented") rented = r.n;
    else if (r.status === "trial") trial = r.n;
  }

  return {
    rented: { count: rented, monthlyRevenue: toMoneyString(rentedRev?.total ?? "0") },
    trial: { count: trial },
    notRented: {
      count: total - rented - trial,
      leads30d: notRentedLeads?.n ?? 0,
      targetRent: toMoneyString(notRentedTarget?.total ?? "0"),
    },
  };
}
