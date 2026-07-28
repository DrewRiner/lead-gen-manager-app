import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import { formatPercentChange } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Percent-change indicator. `pct` null => no prior-period data ("—").
 * `invert` flips the good/bad coloring (e.g. for "gap", down is good).
 */
export function DeltaBadge({
  pct,
  invert = false,
  className,
}: {
  pct: number | null;
  invert?: boolean;
  className?: string;
}) {
  const isFlat = pct == null || Math.round(pct * 10) / 10 === 0;
  const isUp = pct != null && pct > 0;
  const good = invert ? !isUp : isUp;

  const Icon = isFlat ? ArrowRight : isUp ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
        isFlat
          ? "bg-muted text-muted-foreground"
          : good
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
            : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
        className,
      )}
      title="vs. immediately preceding period of equal length"
    >
      <Icon className="h-3 w-3" />
      {formatPercentChange(pct)}
    </span>
  );
}
