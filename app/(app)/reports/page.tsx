import { MonthSelector } from "@/components/reports/month-selector";
import { ReportView } from "@/components/reports/report-view";
import { PageHeader } from "@/components/page-header";
import {
  currentMonthKey,
  parseMonthKey,
  recentMonths,
} from "@/lib/dates";
import { getMonthlyReport } from "@/lib/queries/metrics";
import { getProducingHealthMap } from "@/lib/queries/producing-health";
import type { ReportRowHealth } from "@/components/reports/report-view";
import { getAppSettings } from "@/lib/settings";

export const metadata = { title: "Reports — LeadGen" };
export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const settings = await getAppSettings();
  const tz = settings.orgTimezone;
  const now = new Date();

  const selected = parseMonthKey(sp.month, tz, now);
  const [report, healthResult] = await Promise.all([
    getMonthlyReport(tz, selected),
    getProducingHealthMap(tz, {
      minBillableLeads: settings.producingMinBillableLeads,
      monthsRequired: settings.producingMonthsRequired,
    }),
  ]);

  // Current producing-health per property (independent of the selected month).
  const health: Record<string, ReportRowHealth> = {};
  for (const [id, h] of healthResult.map) {
    health[id] = {
      signal: h.health.signal,
      momentum: h.health.momentum,
      reason: h.health.reason,
    };
  }

  // This month + previous 12 = 13 options; covers "this", "last", "previous 12".
  const monthOptions = recentMonths(tz, 13, now).map((m) => ({
    key: m.key,
    label: m.label,
  }));
  const thisMonth = currentMonthKey(tz, now);
  const lastMonthList = recentMonths(tz, 2, now);
  const lastMonth = lastMonthList[1] ?? thisMonth;

  return (
    <div>
      <PageHeader
        title="Monthly performance"
        description={`Calendar months in ${tz}. Gap = estimated value − actual revenue.`}
      >
        <MonthSelector
          months={monthOptions}
          selected={selected.key}
          thisMonthKey={thisMonth.key}
          lastMonthKey={lastMonth.key}
        />
      </PageHeader>

      <div className="mb-4 text-lg font-semibold">{selected.label}</div>

      <ReportView
        rows={report.rows}
        monthLabel={selected.label}
        monthKey={selected.key}
        health={health}
      />
    </div>
  );
}
