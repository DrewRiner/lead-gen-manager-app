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

  return (
    <div className="mb-6">
      {/* Month-by-month breakdown — the deep view. The at-a-glance summary
          (this month's cost/lead vs market) lives in the revenue strip up top. */}
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
