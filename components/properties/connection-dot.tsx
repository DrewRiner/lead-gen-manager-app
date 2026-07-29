import {
  connectionTooltip,
  isConnected,
  type ConnectionInput,
} from "@/lib/connection";
import { cn } from "@/lib/utils";

// A single dot before a property name: green = has a Lead Source (forms can
// route here), red = doesn't.
export function ConnectionDot({
  property,
  className,
}: {
  property: ConnectionInput;
  className?: string;
}) {
  const connected = isConnected(property);
  const tooltip = connectionTooltip(connected);
  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
        connected ? "bg-emerald-500" : "bg-red-500",
        className,
      )}
    />
  );
}
