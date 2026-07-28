import { DeltaBadge } from "@/components/delta-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { percentChange, type RangeMetrics } from "@/lib/queries/metrics";
import { formatNumber } from "@/lib/format";
import { formatCurrency, toMoneyNumber } from "@/lib/money";

export function MetricCard({
  title,
  current,
  previous,
}: {
  title: string;
  current: RangeMetrics;
  previous: RangeMetrics;
}) {
  const leadsPct = percentChange(current.totalLeads, previous.totalLeads);
  const revenuePct = percentChange(
    toMoneyNumber(current.actualRevenue),
    toMoneyNumber(previous.actualRevenue),
  );
  const estPct = percentChange(
    toMoneyNumber(current.estimatedValue),
    toMoneyNumber(previous.estimatedValue),
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">
            {formatNumber(current.totalLeads)}
          </span>
          <span className="text-sm text-muted-foreground">leads</span>
          <DeltaBadge pct={leadsPct} className="ml-auto" />
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Stat label="Calls" value={formatNumber(current.calls)} />
          <Stat label="Forms" value={formatNumber(current.forms)} />
          <Stat label="Billable" value={formatNumber(current.billable)} />
          <Stat
            label="Bill. rate"
            value={
              current.totalLeads > 0
                ? `${Math.round((current.billable / current.totalLeads) * 100)}%`
                : "—"
            }
          />
        </div>

        <div className="space-y-2 border-t pt-3">
          <MoneyRow
            label="Actual revenue"
            value={formatCurrency(current.actualRevenue)}
            pct={revenuePct}
          />
          <MoneyRow
            label="Estimated value"
            value={formatCurrency(current.estimatedValue)}
            pct={estPct}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  pct,
}: {
  label: string;
  value: string;
  pct: number | null;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-semibold tabular-nums">{value}</span>
        <DeltaBadge pct={pct} />
      </span>
    </div>
  );
}
