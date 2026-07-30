import { rentalDisplay } from "@/lib/property-status";
import { cn } from "@/lib/utils";

// Simplified property status: Rented / Trial / Not rented (display only).
const STYLES: Record<string, string> = {
  Rented: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  Trial: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
  "Not rented": "bg-muted text-muted-foreground",
};

export function PropertyStatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const label = rentalDisplay(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STYLES[label],
        className,
      )}
    >
      {label}
    </span>
  );
}
