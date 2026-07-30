import { titleCase } from "@/lib/format";
import { providerLabel } from "@/lib/providers";
import { cn } from "@/lib/utils";

// Color-coded provider badge for a lead's source_system. Display only — the raw
// source_system values in the DB are unchanged; "EE" is just the label for ghl.
// Exact brand hexes are inlined so they render identically in light/dark.
const STYLES: Record<string, { label: string; bg: string; fg: string }> = {
  ghl: { label: "EE", bg: "#baf25a", fg: "#1a1a1a" }, // Engine Evolve
  callrail: { label: "CallRail", bg: "#2563eb", fg: "#ffffff" },
  twilio: { label: "Twilio", bg: "#dc2626", fg: "#ffffff" },
};

const BASE =
  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none";

export function SourceBadge({
  sourceSystem,
  className,
}: {
  sourceSystem: string | null | undefined;
  className?: string;
}) {
  const key = (sourceSystem ?? "").toLowerCase();
  const styled = STYLES[key];
  if (styled) {
    return (
      <span
        title={providerLabel(key)}
        className={cn(BASE, className)}
        style={{ backgroundColor: styled.bg, color: styled.fg }}
      >
        {styled.label}
      </span>
    );
  }
  // Manual / anything else -> neutral gray (theme-aware).
  const label = key === "manual" ? "Manual" : titleCase(sourceSystem ?? "—");
  return (
    <span className={cn(BASE, "bg-muted text-muted-foreground", className)}>
      {label}
    </span>
  );
}
