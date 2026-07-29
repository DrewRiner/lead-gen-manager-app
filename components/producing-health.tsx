import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import type { HealthSignal, Momentum } from "@/lib/producing-health";
import { cn } from "@/lib/utils";

// Presentational helpers for the derived producing-health signal. Advisory only
// — they visualize lib/producing-health.ts output and never change status.

const DOT: Record<
  Exclude<HealthSignal, "neutral">,
  { cls: string; label: string }
> = {
  match: {
    cls: "bg-emerald-500",
    label: "Producing — billable lead flow confirms the status",
  },
  overstated: {
    cls: "bg-amber-500",
    label: "Marked producing but the lead flow doesn't meet the bar",
  },
  understated: {
    cls: "bg-blue-500",
    label: "Meets the producing bar but still marked pre-launch — likely ready to sell",
  },
};

/** A small colored status dot; renders nothing for the neutral signal. */
export function HealthDot({
  signal,
  reason,
  className,
}: {
  signal: HealthSignal;
  reason?: string | null;
  className?: string;
}) {
  if (signal === "neutral") return null;
  const d = DOT[signal];
  const title = reason ?? d.label;
  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
        d.cls,
        className,
      )}
    />
  );
}

const MOMENTUM: Record<
  Exclude<Momentum, "none">,
  { Icon: typeof ArrowUpRight; cls: string; label: string }
> = {
  rising: {
    Icon: ArrowUpRight,
    cls: "text-emerald-600 dark:text-emerald-400",
    label: "Billable leads rising vs the prior two months",
  },
  steady: {
    Icon: ArrowRight,
    cls: "text-muted-foreground",
    label: "Billable leads steady over the last 3 months",
  },
  falling: {
    Icon: ArrowDownRight,
    cls: "text-red-600 dark:text-red-400",
    label: "Billable leads falling vs the prior two months",
  },
};

/** A small trend arrow; renders nothing when there's no meaningful volume. */
export function MomentumArrow({
  momentum,
  className,
}: {
  momentum: Momentum;
  className?: string;
}) {
  if (momentum === "none") return null;
  const m = MOMENTUM[momentum];
  const Icon = m.Icon;
  return (
    <span title={m.label} aria-label={m.label} className="inline-flex">
      <Icon className={cn("h-3.5 w-3.5 shrink-0", m.cls, className)} />
    </span>
  );
}
