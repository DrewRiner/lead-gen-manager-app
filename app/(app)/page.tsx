import Link from "next/link";

import {
  DailyVolumeChart,
  type DailyVolumePoint,
} from "@/components/charts/daily-volume-chart";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PageHeader } from "@/components/page-header";
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
import { comparativeDayWindow, lastNLocalDays, trailingDayRange } from "@/lib/dates";
import { formatCurrency } from "@/lib/money";
import { formatNumber } from "@/lib/format";
import {
  getDailyVolume,
  getRangeMetrics,
  getTopProperties,
} from "@/lib/queries/metrics";
import { getAppSettings } from "@/lib/settings";

export const metadata = { title: "Dashboard — LeadGen" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { orgTimezone: tz } = await getAppSettings();
  const now = new Date();

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
  ] = await Promise.all([
    getRangeMetrics(today.current),
    getRangeMetrics(today.previous),
    getRangeMetrics(week.current),
    getRangeMetrics(week.previous),
    getRangeMetrics(month.current),
    getRangeMetrics(month.previous),
    getDailyVolume(tz, chartRange),
    getTopProperties(tz, chartRange),
  ]);

  // Fill every day in the 30-day window (org tz), zero where no leads.
  const volumeByDay = new Map(dailyVolume.map((d) => [d.day, d]));
  const chartData: DailyVolumePoint[] = lastNLocalDays(tz, 30, now).map((d) => {
    const row = volumeByDay.get(d.key);
    return {
      day: d.key,
      label: d.label,
      calls: row?.calls ?? 0,
      forms: row?.forms ?? 0,
    };
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Lead performance across all properties. Times in ${tz}.`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard title="Today" current={todayCur} previous={todayPrev} />
        <MetricCard title="Last 7 Days" current={weekCur} previous={weekPrev} />
        <MetricCard
          title="Last 30 Days"
          current={monthCur}
          previous={monthPrev}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Daily lead volume</CardTitle>
          <CardDescription>
            Last 30 days, calls and forms stacked.
          </CardDescription>
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
        <CardHeader>
          <CardTitle>Top performing properties</CardTitle>
          <CardDescription>
            Last 30 days, ranked by estimated value.
          </CardDescription>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProperties.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No leads in the last 30 days.
                    </TableCell>
                  </TableRow>
                ) : (
                  topProperties.map((p) => (
                    <TableRow key={p.propertyId}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/properties/${p.propertyId}`}
                          className="hover:underline"
                        >
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">
                        {p.niche ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.city ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.clientName ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(p.calls)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(p.forms)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(p.total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(p.billable)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(p.estimatedValue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(p.actualRevenue)}
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

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
