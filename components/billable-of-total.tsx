import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * "1 of 4" — billable leads (emphasised, drives revenue) over total leads
 * (muted). Display only; both counts come straight from the leads aggregation.
 */
export function BillableOfTotal({
  billable,
  total,
  className,
}: {
  billable: number;
  total: number;
  className?: string;
}) {
  return (
    <span className={cn("whitespace-nowrap tabular-nums", className)}>
      <span className="font-medium text-foreground">{formatNumber(billable)}</span>
      <span className="font-normal text-muted-foreground"> of {formatNumber(total)}</span>
    </span>
  );
}
