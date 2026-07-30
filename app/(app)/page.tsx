import Link from "next/link";

import {
  DailyVolumeChart,
  type DailyVolumePoint,
} from "@/components/charts/daily-volume-chart";
import {
  LifetimeTrendChart,
  type LifetimeTrendPointView,
} from "@/components/charts/lifetime-trend-chart";
import { LifetimeTable } from "@/components/dashboard/lifetime-table";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PipelineStrip } from "@/components/dashboard/pipeline-strip";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { TabLink, TabNav } from "@/components/tab-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  comparativeDayWindow,
  currentMonthKey,
  lastNLocalDays,
  trailingDayRange,
} from "@/lib/dates";
import { formatCurrency, toMoneyNumber } from "@/lib/money";
import { formatNumber } from "@/lib/format";
import {
  getDailyVolume,
  getPropertyEconomicsMap,
  getRangeMetrics,
  getTopProperties,
} from "@/lib/queries/metrics";
import { cn } from "@/lib/utils";
import { getLifetimeRollup, getTrialSummary } from "@/lib/queries/lifetime";
import { RevenueByClientChart } from "@/components/charts/revenue-by-client-chart";
import { getPipelineSummary } from "@/lib/queries/pipeline";
import { getConnectionSummary } from "@/lib/queries/connection";
import {
  getRevenueByClient,
  type RevenueRange,
} from "@/lib/queries/revenue-by-client";
import { getAppSettings } from "@/lib/settings";

export const metadata = { title: "Dashboard — LeadGen" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; rev?: string }>;
}) {
  const sp = await searchParams;
  const { orgTimezone: tz } = await getAppSettings();
  const tab = sp.tab === "lifetime" ? "lifetime" : "activity";

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Lead performance across all properties. Times in ${tz}.`}
      />

      <TabNav>
        <TabLink href="/?tab=activity" active={tab === "activity"}>
          Activity
        </TabLink>
        <TabLink href="/?tab=lifetime" active={tab === "lifetime"}>
          Lifetime
        </TabLink>
      </TabNav>

      {tab === "activity" ? (
        <ActivityTab tz={tz} revRange={sp.rev} />
      ) : (
        <LifetimeTab tz={tz} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity tab — everything that was on the dashboard.
// ---------------------------------------------------------------------------

const REV_RANGES: { key: RevenueRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "all", label: "All time" },
];

async function ActivityTab({
  tz,
  revRange,
}: {
  tz: string;
  revRange?: string;
}) {
  const now = new Date();
  const rev: RevenueRange = REV_RANGES.some((r) => r.key === revRange)
    ? (revRange as RevenueRange)
    : "30d";
  const today = comparativeDayWindow(tz, 1, now);
  const week = comparativeDayWindow(tz, 7, now);
  const month = comparativeDayWindow(tz, 30, now);
  const chartRange = trailingDayRange(tz, 30, now);

  const [
    todayCur,
    todayPrev,
    weekCur,
    weekPrev,
    monthCur,
    monthPrev,
    dailyVolume,
    topProperties,
    pipeline,
    connection,
    econByProp,
    revByClient,
  ] = await Promise.all([
    getRangeMetrics(today.current),
    getRangeMetrics(today.previous),
    getRangeMetrics(week.current),
    getRangeMetrics(week.previous),
    getRangeMetrics(month.current),
    getRangeMetrics(month.previous),
    getDailyVolume(tz, chartRange),
    getTopProperties(tz, chartRange),
    getPipelineSummary(tz),
    getConnectionSummary(),
    getPropertyEconomicsMap(tz, currentMonthKey(tz)),
    getRevenueByClient(tz, rev),
  ]);

  const volumeByDay = new Map(dailyVolume.map((d) => [d.day, d]));
  const chartData: DailyVolumePoint[] = lastNLocalDays(tz, 30, now).map((d) => {
    const row = volumeByDay.get(d.key);
    return { day: d.key, label: d.label, calls: row?.calls ?? 0, forms: row?.forms ?? 0 };
  });

  return (
    <div>
      <PipelineStrip summary={pipeline} />

      {connection.notConnected > 0 ? (
        <Link
          href="/properties?connected=not_connected"
          className="mb-4 block text-sm text-muted-foreground hover:text-foreground"
        >
          {connection.notConnected} propert
          {connection.notConnected === 1 ? "y" : "ies"} not connected →
        </Link>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard title="Today" current={todayCur} previous={todayPrev} />
        <MetricCard title="Last 7 Days" current={weekCur} previous={weekPrev} />
        <MetricCard title="Last 30 Days" current={monthCur} previous={monthPrev} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Daily lead volume</CardTitle>
          <CardDescription>Last 30 days, calls and forms stacked.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
            <LegendDot color="hsl(221 83% 53%)" label="Calls" />
            <LegendDot color="hsl(160 60% 45%)" label="Forms" />
          </div>
          <DailyVolumeChart data={chartData} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Revenue by client</CardTitle>
            <CardDescription>
              Where revenue comes from. Flat rent + per-lead charges; trials show
              at $0.
            </CardDescription>
          </div>
          <div className="flex shrink-0 gap-1">
            {REV_RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/?tab=activity&rev=${r.key}`}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  r.key === rev
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <RevenueByClientChart data={revByClient} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Top performing properties</CardTitle>
          <CardDescription>Last 30 days, ranked by estimated value.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Niche</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Forms</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Billable</TableHead>
                  <TableHead className="text-right">Est. value</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right" title="Your actual cost per lead">
                    Actual cost/lead
                  </TableHead>
                  <TableHead className="text-right">Market $/lead</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProperties.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-8 text-center text-muted-foreground">
                      No leads in the last 30 days.
                    </TableCell>
                  </TableRow>
                ) : (
                  topProperties.map((p) => (
                    <TableRow key={p.propertyId}>
                      <TableCell className="font-medium">
                        <Link href={`/properties/${p.propertyId}`} className="hover:underline">
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">{p.niche ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.city ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.clientName ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(p.calls)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(p.forms)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(p.total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(p.billable)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(p.estimatedValue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(p.actualRevenue)}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          econByProp.get(p.propertyId)?.underpriced
                            ? "font-semibold text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground",
                        )}
                        title={
                          econByProp.get(p.propertyId)?.underpriced
                            ? "Your actual cost per lead is well below market — a candidate to move to pay-per-lead. (This calendar month.)"
                            : "This calendar month"
                        }
                      >
                        {econByProp.get(p.propertyId)?.effectiveLabel ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {econByProp.get(p.propertyId)?.marketLabel ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lifetime tab — all-time business rollup.
// ---------------------------------------------------------------------------

async function LifetimeTab({ tz }: { tz: string }) {
  const [roll, trials] = await Promise.all([
    getLifetimeRollup(tz),
    getTrialSummary(tz),
  ]);
  const h = roll.headline;

  const diffNum = toMoneyNumber(h.difference);
  const multiple = h.multiple != null ? `${(Math.round(h.multiple * 10) / 10).toFixed(1)}x` : "—";
  const diffValue = `${diffNum >= 0 ? "+" : ""}${formatCurrency(h.difference)} · ${multiple}`;

  const trendData: LifetimeTrendPointView[] = roll.trend.map((t) => ({
    label: t.label,
    actual: toMoneyNumber(t.actualRevenue),
    potential: toMoneyNumber(t.potentialRevenue),
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total leads"
          value={formatNumber(h.totalLeads)}
          hint={`${formatNumber(h.calls)} calls · ${formatNumber(h.forms)} forms · ${formatNumber(h.billable)} billable`}
        />
        <StatCard
          label="Actual revenue earned"
          value={formatCurrency(h.actualRevenue)}
          hint="Flat rent from assignments + per-lead billed"
        />
        <StatCard
          label="Potential per-lead revenue (ceiling)"
          value={formatCurrency(h.potentialRevenue)}
          hint="If every billable lead had sold at market rate. Actual per-lead revenue would be lower — clients churn, cap spend, and dispute leads."
        />
        <StatCard
          label="Difference"
          value={diffValue}
          hint="Potential − actual, and the multiple"
        />
      </div>

      <div>
        <div className="mb-2 text-sm font-medium text-muted-foreground">
          Free trial program (all-time)
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Trials run" value={formatNumber(trials.trialsRun)} />
          <StatCard label="Converted" value={formatNumber(trials.converted)} />
          <StatCard
            label="Conversion rate"
            value={
              trials.conversionRate != null
                ? `${Math.round(trials.conversionRate * 100)}%`
                : "—"
            }
            hint="of concluded trials"
          />
          <StatCard
            label="Avg days to convert"
            value={
              trials.avgDaysToConvert != null
                ? `${Math.round(trials.avgDaysToConvert)} days`
                : "—"
            }
          />
          <StatCard
            label="Est. value given away"
            value={formatCurrency(trials.estimatedGivenAway)}
            hint="Delivered in trials that didn't convert — the real cost of the program"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actual vs potential per-lead revenue</CardTitle>
          <CardDescription>
            All months in {tz}. Watch whether the gap is widening.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LifetimeTrendChart data={trendData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Per-property, all-time</CardTitle>
            <CardDescription>
              Sorted by the gap — the most underpriced contracts sort to the top.
            </CardDescription>
          </div>
          <Link href="/reports" className="text-sm text-primary hover:underline">
            Month-by-month in Reports →
          </Link>
        </CardHeader>
        <CardContent className="px-0">
          <LifetimeTable rows={roll.properties} />
        </CardContent>
      </Card>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
