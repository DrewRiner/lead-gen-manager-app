// TEMPORARY, THROWAWAY DIAGNOSTIC ROUTE — delete after collecting numbers.
// Token-gated (404 without the exact ?token=DIAG_TOKEN so it isn't discoverable).
// No auth / no cookies() -> not dynamic-by-auth; excluded from middleware matcher.
// Measures real Vercel cold-start + query costs so we stop extrapolating locally.
import { performance } from "node:perf_hooks";

import { NextResponse } from "next/server";
import { and, gte, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { leads, properties } from "@/lib/db/schema";
import {
  comparativeCalendarWindow,
  comparativeDayWindow,
  currentMonthKey,
  trailingDayRange,
} from "@/lib/dates";
import {
  getDailyVolume,
  getPropertyEconomics,
  getPropertyEconomicsMap,
  getPropertyMonthlySeries,
  getRangeMetrics,
  getTopProperties,
} from "@/lib/queries/metrics";
import { getPropertyLifetime } from "@/lib/queries/assignments";
import { getLeads, getLeadTypeCounts } from "@/lib/queries/leads";
import { getConnectionSummary, getRealLeadAt } from "@/lib/queries/connection";
import { getPipelineSummary } from "@/lib/queries/pipeline";
import { getRevenueByClient } from "@/lib/queries/revenue-by-client";
import { getOrgTimezone } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Module-scope: captured once at import (function init), and flipped on the
// first request this warm instance serves — this is how we detect cold starts.
const moduleInitAt = performance.now();
let seenRequest = false;

const round = (n: number, d = 1) => Number(n.toFixed(d));

export async function GET(request: Request) {
  // Guard FIRST: undiscoverable 404 unless the exact token is supplied.
  const token = new URL(request.url).searchParams.get("token");
  if (!process.env.DIAG_TOKEN || token !== process.env.DIAG_TOKEN) {
    return new NextResponse("Not found", { status: 404 });
  }

  const reqStart = performance.now();
  const coldInstance = !seenRequest;
  const moduleInitToFirstRequestMs = coldInstance
    ? round(reqStart - moduleInitAt)
    : null;
  seenRequest = true;

  const t: Record<string, number | null> = {};
  async function measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const s = performance.now();
    const r = await fn();
    t[label] = round(performance.now() - s);
    return r;
  }

  // 2. Connection setup: the FIRST query on this instance. On a cold instance
  //    this includes TLS + Supavisor auth; on a warm one it's ~a round-trip.
  await measure("connectMs", () => db.execute(sql`select 1`));

  const tz = await getOrgTimezone();
  const now = new Date();
  const { start, end } = trailingDayRange(tz, 30, now);
  const range = { start, end };

  // Raw aggregation identical in shape to getRangeMetrics, executed directly.
  const aggSql = sql`select count(*)::int as t,
      coalesce(sum(${leads.billedAmount}), 0) as r
    from ${leads}
    where ${leads.deletedAt} is null
      and ${leads.occurredAt} >= ${start} and ${leads.occurredAt} < ${end}`;

  // 3-6: isolate the drizzle-builder overhead and the concurrency behavior.
  await measure("rawExecuteMs", () => db.execute(aggSql));
  await measure("builderMs", () => getRangeMetrics(range));
  await measure("builder6ParallelMs", () =>
    Promise.all(Array.from({ length: 6 }, () => getRangeMetrics(range))),
  );
  await measure("raw6ParallelMs", () =>
    Promise.all(Array.from({ length: 6 }, () => db.execute(aggSql))),
  );

  // 7. THE KEY NUMBER: drizzle's CPU to build the query + serialize to SQL,
  //    WITHOUT executing (no network). ~0 => the builder overhead is a
  //    round-trip (shrinks on Vercel); ~20ms => it's CPU (does not shrink).
  //    Averaged over N to get a stable per-call figure; JIT-warmed first.
  const buildQuery = () =>
    db
      .select({
        totalLeads: sql<number>`count(*)::int`,
        calls: sql<number>`count(*) filter (where ${leads.type} = 'call')::int`,
        forms: sql<number>`count(*) filter (where ${leads.type} = 'form')::int`,
        billable: sql<number>`count(*) filter (where ${leads.billableStatus} = 'billable')::int`,
        actualRevenue: sql<string>`coalesce(sum(${leads.billedAmount}), 0)::text`,
        estimatedValue: sql<string>`coalesce(sum(${leads.estimatedValue}) filter (where ${leads.billableStatus} = 'billable'), 0)::text`,
      })
      .from(leads)
      .where(
        and(
          isNull(leads.deletedAt),
          gte(leads.occurredAt, start),
          lt(leads.occurredAt, end),
        ),
      );
  buildQuery().toSQL(); // warm JIT
  {
    const ITER = 50;
    const s = performance.now();
    for (let i = 0; i < ITER; i++) buildQuery().toSQL();
    t.buildOnlyMs = round((performance.now() - s) / ITER, 3);
  }

  // 8. Full dashboard (activity) query set — the real Promise.all the page runs.
  const day = comparativeDayWindow(tz, 1, now);
  const week = comparativeDayWindow(tz, 7, now);
  const month = comparativeDayWindow(tz, 30, now);
  const chartRange = trailingDayRange(tz, 30, now);
  const monthKey = currentMonthKey(tz, now);
  await measure("dashboardSetMs", () =>
    Promise.all([
      getRangeMetrics(day.current),
      getRangeMetrics(day.previous),
      getRangeMetrics(week.current),
      getRangeMetrics(week.previous),
      getRangeMetrics(month.current),
      getRangeMetrics(month.previous),
      getDailyVolume(tz, chartRange),
      getTopProperties(tz, chartRange),
      getPipelineSummary(tz),
      getConnectionSummary(),
      getPropertyEconomicsMap(tz, monthKey),
      getRevenueByClient(tz, "30d"),
    ]),
  );

  // 9. Full property-detail query set — mirrors the page's sequential phases.
  const [prop] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(isNull(properties.deletedAt))
    .limit(1);
  if (prop) {
    const pid = prop.id;
    const opts = { propertyId: pid };
    const dayW = comparativeCalendarWindow("day", tz);
    const weekW = comparativeCalendarWindow("week", tz);
    const monthW = comparativeCalendarWindow("month", tz);
    await measure("propertyDetailSetMs", async () => {
      // Phase A: header data (property row already fetched above).
      await Promise.all([getRealLeadAt(pid), getPropertyEconomics(tz, pid, monthKey)]);
      // Phase B: revenue strip.
      await Promise.all([
        getPropertyMonthlySeries(tz, pid, [monthKey]),
        getPropertyLifetime(tz, pid),
      ]);
      // Phase C: activity tab.
      await Promise.all([
        getRangeMetrics(dayW.current, opts),
        getRangeMetrics(dayW.previous, opts),
        getRangeMetrics(weekW.current, opts),
        getRangeMetrics(weekW.previous, opts),
        getRangeMetrics(monthW.current, opts),
        getRangeMetrics(monthW.previous, opts),
        getLeads(tz, { propertyId: pid }, 1, 25),
        getLeadTypeCounts(tz, { propertyId: pid }),
      ]);
    });
  } else {
    t.propertyDetailSetMs = null;
  }

  return NextResponse.json(
    {
      note: "throwaway diagnostic — delete after use",
      coldInstance,
      moduleInitToFirstRequestMs,
      region: process.env.VERCEL_REGION ?? null,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      requestHandlerMs: round(performance.now() - reqStart),
      at: new Date().toISOString(),
      ...t,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
