import { connectionStatus, type ConnectionInput } from "@/lib/connection";
import { cn } from "@/lib/utils";

// A single dot before a property name. GREEN = a real lead arrived in the last
// 30 days OR an admin marked it ready; RED = neither. Reports reality, not the
// ghl_lead_source config field.
export function ConnectionDot({
  connection,
  className,
}: {
  connection: ConnectionInput;
  className?: string;
}) {
  const status = connectionStatus(connection);
  return (
    <span
      title={status.tooltip}
      aria-label={status.tooltip}
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
        status.connected ? "bg-emerald-500" : "bg-red-500",
        className,
      )}
    />
  );
}
