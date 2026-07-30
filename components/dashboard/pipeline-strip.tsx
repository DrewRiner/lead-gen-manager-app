import Link from "next/link";

import { formatNumber } from "@/lib/format";
import { formatCurrency } from "@/lib/money";
import type { PipelineSummary } from "@/lib/queries/pipeline";
import { cn } from "@/lib/utils";

// Three states only: Rented (monthly revenue), Trial, Not rented (lead volume
// + total target rent).
export function PipelineStrip({ summary }: { summary: PipelineSummary }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Segment
        href="/properties?rental=rented"
        label="Rented"
        count={summary.rented.count}
        emphasized
        lines={[`${formatCurrency(summary.rented.monthlyRevenue)} / mo now`]}
      />
      <Segment href="/properties?rental=trial" label="Trial" count={summary.trial.count} />
      <Segment
        href="/properties?rental=not_rented"
        label="Not rented"
        count={summary.notRented.count}
        lines={[
          `${formatNumber(summary.notRented.leads30d)} leads · 30d`,
          `${formatCurrency(summary.notRented.targetRent)} target rent`,
        ]}
      />
    </div>
  );
}

function Segment({
  href,
  label,
  count,
  lines,
  emphasized = false,
}: {
  href: string;
  label: string;
  count: number;
  lines?: string[];
  emphasized?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg border p-4 transition-colors hover:bg-muted/50",
        emphasized &&
          "border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-200 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40 dark:ring-emerald-900",
      )}
    >
      <div
        className={cn(
          "text-xs font-medium uppercase tracking-wide",
          emphasized
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-muted-foreground",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-bold tabular-nums",
          emphasized ? "text-3xl" : "text-2xl",
        )}
      >
        {formatNumber(count)}
      </div>
      {lines?.length ? (
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {lines.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
