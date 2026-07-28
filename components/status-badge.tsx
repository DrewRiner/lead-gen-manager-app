import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";

const COLORS: Record<string, string> = {
  // property lifecycle
  building: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  optimizing: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  producing: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  rented: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  paused: "bg-muted text-muted-foreground",
  // client
  churned: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  // lead billable status
  billable: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  not_billable: "bg-muted text-muted-foreground",
  disputed: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  pending_review: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  spam: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  // delivery status
  new: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  billed: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        COLORS[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {titleCase(status)}
    </span>
  );
}
