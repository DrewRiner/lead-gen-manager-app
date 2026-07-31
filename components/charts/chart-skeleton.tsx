import { cn } from "@/lib/utils";

/** Placeholder shown while a chart's JS (recharts) loads on the client. */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex w-full animate-pulse items-end gap-1.5 rounded-md bg-muted/30 p-4",
        className,
      )}
      aria-hidden
    >
      {[40, 65, 50, 80, 55, 70, 45, 60].map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-muted"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
