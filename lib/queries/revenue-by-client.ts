import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";

import { activeOnDate } from "@/lib/assignments";
import { lastNLocalDays, todayDateStr, trailingDayRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { clients, leads, propertyAssignments } from "@/lib/db/schema";
import { toMoneyNumber } from "@/lib/money";

// Revenue attributed to each CLIENT over a period, reusing the assignment-based
// revenue rules (no reinvented math):
//   • flat_monthly / hybrid: the monthly rate prorated across the period's days
//     (per-day = monthly_rate / days-in-that-month; via activeOnDate)
//   • per_lead / hybrid: SUM(billed_amount) on the client's leads in the period
//   • TRIAL assignments book $0 (a trial client shows up with $0 revenue)
// Only clients with an assignment active in the period are counted.

export type RevenueRange = "today" | "7d" | "30d" | "all";

export interface ClientRevenue {
  clientId: string;
  clientName: string;
  revenue: number;
  /** Has a TRIAL assignment active in the period (may still be $0). */
  hasTrial: boolean;
}

function daysInMonthOf(dayKey: string): number {
  const [y, m] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function daysFromTo(startKey: string, endKey: string): string[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const [ys, ms, ds] = startKey.split("-").map(Number);
  const [ye, me, de] = endKey.split("-").map(Number);
  let cur = Date.UTC(ys, ms - 1, ds);
  const end = Date.UTC(ye, me - 1, de);
  const out: string[] = [];
  while (cur <= end) {
    const d = new Date(cur);
    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
    cur += 86_400_000;
  }
  return out;
}

export async function getRevenueByClient(
  tz: string,
  range: RevenueRange,
): Promise<ClientRevenue[]> {
  const lastDay = todayDateStr(tz);

  // Window: the local days it spans (for flat proration) + a UTC range (for leads).
  let days: string[];
  let leadStart: Date;
  let leadEnd: Date;
  if (range === "all") {
    const [minRow] = await db
      .select({ min: sql<string | null>`min(${propertyAssignments.startedOn})` })
      .from(propertyAssignments);
    days = daysFromTo(minRow?.min ?? lastDay, lastDay);
    leadStart = new Date(0);
    leadEnd = trailingDayRange(tz, 1).end; // end of today
  } else {
    const n = range === "today" ? 1 : range === "7d" ? 7 : 30;
    days = lastNLocalDays(tz, n).map((d) => d.key);
    const r = trailingDayRange(tz, n);
    leadStart = r.start;
    leadEnd = r.end;
  }
  const firstDay = days[0] ?? lastDay;

  // Every assignment (few rows), with client name; keep those overlapping the window.
  const asgRows = await db
    .select({
      clientId: propertyAssignments.clientId,
      clientName: clients.businessName,
      billingType: propertyAssignments.billingType,
      monthlyRate: propertyAssignments.monthlyRate,
      isTrial: propertyAssignments.isTrial,
      startedOn: propertyAssignments.startedOn,
      endedOn: propertyAssignments.endedOn,
    })
    .from(propertyAssignments)
    .innerJoin(clients, eq(clients.id, propertyAssignments.clientId));

  const overlapping = asgRows.filter(
    (a) => a.startedOn <= lastDay && (a.endedOn === null || a.endedOn >= firstDay),
  );

  // Clients active in the period (defines who appears at all — incl $0 trials).
  const acc = new Map<string, { name: string; cents: number; hasTrial: boolean }>();
  for (const a of overlapping) {
    const e = acc.get(a.clientId) ?? { name: a.clientName ?? "—", cents: 0, hasTrial: false };
    if (a.isTrial) e.hasTrial = true;
    acc.set(a.clientId, e);
  }

  // Flat rent prorated per day (paid flat/hybrid only; trials book nothing).
  const flatAsg = overlapping.filter(
    (a) => !a.isTrial && (a.billingType === "flat_monthly" || a.billingType === "hybrid"),
  );
  for (const d of days) {
    const dim = daysInMonthOf(d);
    for (const a of flatAsg) {
      if (activeOnDate(a, d)) {
        acc.get(a.clientId)!.cents += Math.round((toMoneyNumber(a.monthlyRate) / dim) * 100);
      }
    }
  }

  // Per-lead charges (billed_amount) in the window, grouped by client.
  const leadRows = await db
    .select({
      clientId: leads.clientId,
      billed: sql<string>`coalesce(sum(${leads.billedAmount}), 0)::text`,
    })
    .from(leads)
    .where(
      and(
        isNull(leads.deletedAt),
        sql`${leads.clientId} is not null`,
        gte(leads.occurredAt, leadStart),
        lt(leads.occurredAt, leadEnd),
      ),
    )
    .groupBy(leads.clientId);
  for (const r of leadRows) {
    if (!r.clientId) continue;
    const c = acc.get(r.clientId); // only clients with an active assignment count
    if (c) c.cents += Math.round(toMoneyNumber(r.billed) * 100);
  }

  return Array.from(acc, ([clientId, v]) => ({
    clientId,
    clientName: v.name,
    revenue: v.cents / 100,
    hasTrial: v.hasTrial,
  })).sort((a, b) => b.revenue - a.revenue || a.clientName.localeCompare(b.clientName));
}
