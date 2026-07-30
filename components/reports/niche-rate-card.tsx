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
import { formatCurrency } from "@/lib/money";
import type { NicheRateCardRow } from "@/lib/queries/metrics";

// A reference "rate card": the going market lead value per niche, aggregated
// from the estimated values on the properties in that niche. When properties in
// the same niche disagree, we show the range and note the average.
export function NicheRateCard({ rows }: { rows: NicheRateCardRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Niche rate card</CardTitle>
        <CardDescription>
          The going market value per lead by industry — the reference for what a
          lead is worth, independent of what any client pays. Aggregated from each
          niche&rsquo;s properties; a range means the properties disagree.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Niche</TableHead>
                <TableHead className="text-right">Properties</TableHead>
                <TableHead className="text-right">Market $/call</TableHead>
                <TableHead className="text-right">Market $/form</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No niches set on any property yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.niche}>
                    <TableCell className="font-medium capitalize">{r.niche}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.propertyCount}
                    </TableCell>
                    <RateCell
                      avg={r.callAvg}
                      min={r.callMin}
                      max={r.callMax}
                      varies={r.callVaries}
                    />
                    <RateCell
                      avg={r.formAvg}
                      min={r.formMin}
                      max={r.formMax}
                      varies={r.formVaries}
                    />
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function RateCell({
  avg,
  min,
  max,
  varies,
}: {
  avg: string;
  min: string;
  max: string;
  varies: boolean;
}) {
  if (!varies) {
    return (
      <TableCell className="text-right tabular-nums">
        {formatCurrency(avg)}
      </TableCell>
    );
  }
  return (
    <TableCell className="text-right tabular-nums">
      <span>
        {formatCurrency(min)}–{formatCurrency(max)}
      </span>
      <span className="ml-1 text-xs text-muted-foreground">
        (avg {formatCurrency(avg)})
      </span>
    </TableCell>
  );
}
