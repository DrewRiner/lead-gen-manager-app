import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { formatNumber } from "@/lib/format";
import { formatCurrency } from "@/lib/money";
import type { PipelineSummary } from "@/lib/queries/pipeline";
import { cn } from "@/lib/utils";

export function PipelineStrip({
  summary,
  reviewCount,
}: {
  summary: PipelineSummary;
  reviewCount: number;
}) {
  const { counts } = summary;

  return (
    <div className="mb-6 space-y-2">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Segment
          href="/properties?status=building"
          label="Building"
          count={counts.building}
        />
        <Segment
          href="/properties?status=optimizing"
          label="Optimizing"
          count={counts.optimizing}
        />
        <Segment
          href="/properties?status=producing"
          label="Producing"
          count={counts.producing}
          emphasized
          lines={[
            `${formatNumber(summary.producingLeads30d)} leads · 30d`,
            `${formatCurrency(summary.producingTargetRent)} target rent`,
          ]}
        />
        <Segment
          href="/properties?status=rented"
          label="Rented"
          count={counts.rented}
          lines={[`${formatCurrency(summary.rentedMonthlyRevenue)} / mo now`]}
        />
      </div>

      {reviewCount > 0 ? (
        <Link
          href="/properties?review=1"
          className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:underline dark:text-amber-400"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {formatNumber(reviewCount)}{" "}
          {reviewCount === 1 ? "property needs" : "properties need"} a status
          review
        </Link>
      ) : null}
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
