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
import { formatNumber } from "@/lib/format";
import { formatCurrency } from "@/lib/money";
import type { PropertyCostPerLead } from "@/lib/queries/metrics";
import { cn } from "@/lib/utils";

// Cost-per-lead breakdown for the property detail page. Two headline stats
// (rolling 30-day, volume-weighted lifetime) each shown against market rate and
// the gap, plus a 12-month table with a cost-per-lead trend. BILLABLE only.

function perLead(n: number | null): string {
  return n == null ? "—" : `${formatCurrency(n)}/lead`;
}
function gapLabel(gap: number | null): { text: string; underpriced: boolean } {
  if (gap == null) return { text: "—", underpriced: false };
  const sign = gap >= 0 ? "+" : "−";
  return { text: `${sign}${formatCurrency(Math.abs(gap))}`, underpriced: gap > 0 };
}

export function CostPerLead({ data }: { data: PropertyCostPerLead }) {
  const meaningful = data.everRented && (data.isFlat || data.isPerLead);
  const chargedLabel = data.isPerLead ? "Charged" : "Rent charged";
  const rentDivLabel = data.isPerLead ? "avg charged per billable lead" : "rent / billable leads";

  if (!meaningful) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Cost per lead</CardTitle>
          <CardDescription>
            Cost per lead is only meaningful once the property is rented on flat
            or hybrid billing. Nothing to show yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const lifeGap = gapLabel(data.lifetime.gap);
  const w = data.window30;
  const wGap = gapLabel(w.gap);

  return (
    <div className="mb-6 space-y-4">
      {/* Two headline stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <HeadlineCard
          label="30-day cost per lead"
          badge="Rolling 30 days"
          value={perLead(w.actual)}
          math={
            w.actual != null
              ? `${formatCurrency(w.rent)} ${data.isPerLead ? "charged" : "rent"} / ${formatNumber(w.billable)} billable ${w.billable === 1 ? "lead" : "leads"}`
              : `No billable leads in the last 30 days`
          }
          market={w.market}
          gap={wGap}
        />
        <HeadlineCard
          label="Lifetime cost per lead"
          badge="Volume-weighted, while rented"
          value={perLead(data.lifetime.actual)}
          math={
            data.lifetime.actual != null
              ? `${formatCurrency(data.lifetime.totalRent)} ${rentDivLabel.startsWith("avg") ? "charged" : "rent"} / ${formatNumber(data.lifetime.totalBillable)} leads = ${perLead(data.lifetime.actual)}`
              : `No billable leads during rented months yet`
          }
          market={data.lifetime.market}
          gap={lifeGap}
        />
      </div>

      {/* Month-by-month breakdown */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Month-by-month cost per lead</CardTitle>
            <CardDescription>
              Last 12 calendar months. {chargedLabel} ÷ billable leads.{" "}
              {data.isPerLead ? "Per-lead billing shows the average charged." : null}
            </CardDescription>
          </div>
          <Trend months={data.months} />
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">{chargedLabel}</TableHead>
                  <TableHead className="text-right">Billable</TableHead>
                  <TableHead className="text-right">Actual $/lead</TableHead>
                  <TableHead className="text-right">Market $/lead</TableHead>
                  <TableHead className="text-right">Gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...data.months].reverse().map((m) => {
                  const g = gapLabel(m.gap);
                  return (
                    <TableRow key={m.key}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.rented ? formatCurrency(m.rent) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(m.billable)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {perLead(m.actual)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {m.actual != null ? formatCurrency(m.market) : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          g.underpriced
                            ? "font-semibold text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {g.text}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HeadlineCard({
  label,
  badge,
  value,
  math,
  market,
  gap,
}: {
  label: string;
  badge: string;
  value: string;
  math: string;
  market: number;
  gap: { text: string; underpriced: boolean };
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {badge}
          </span>
        </div>
        <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{math}</div>
        <div className="mt-3 flex items-center gap-3 border-t pt-3 text-sm">
          <span className="text-muted-foreground">
            Market{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatCurrency(market)}/lead
            </span>
          </span>
          <span
            className={cn(
              "tabular-nums",
              gap.underpriced
                ? "font-semibold text-amber-600 dark:text-amber-400"
                : "text-muted-foreground",
            )}
            title={gap.underpriced ? "Charging below market — reprice candidate." : undefined}
          >
            Gap {gap.text}
            {gap.underpriced ? " · underpriced" : ""}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/** Tiny cost-per-lead trend bars across the 12 months (nulls render faint). */
function Trend({ months }: { months: PropertyCostPerLead["months"] }) {
  const values = months.map((m) => m.actual);
  const max = Math.max(1, ...values.filter((v): v is number => v != null));
  return (
    <div className="flex items-end gap-[3px]" title="Actual cost per lead trend">
      {months.map((m) => {
        const h = m.actual != null ? Math.max(3, Math.round((m.actual / max) * 28)) : 3;
        return (
          <span
            key={m.key}
            className={cn(
              "w-[6px] rounded-sm",
              m.actual != null ? "bg-primary/70" : "bg-muted",
            )}
            style={{ height: h }}
            title={`${m.label}: ${m.actual != null ? `${formatCurrency(m.actual)}/lead` : "—"}`}
          />
        );
      })}
    </div>
  );
}
