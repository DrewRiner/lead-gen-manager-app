"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

// Quick All / Calls / Forms toggle for a single property's leads list. Drives
// the `type` search param and is independent of the global /leads filters. Each
// chip carries its count for the current period so the split is visible at a
// glance without changing the filter.
export function LeadTypeChips({
  total,
  calls,
  forms,
}: {
  total: number;
  calls: number;
  forms: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("type") ?? "all";

  function select(value: "all" | "call" | "form") {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete("type");
    else next.set("type", value);
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const chips: { value: "all" | "call" | "form"; label: string; count: number }[] = [
    { value: "all", label: "All", count: total },
    { value: "call", label: "Calls", count: calls },
    { value: "form", label: "Forms", count: forms },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => {
        const isActive = active === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => select(c.value)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <span>{c.label}</span>
            <span
              className={cn(
                "tabular-nums",
                isActive ? "text-primary-foreground/80" : "text-muted-foreground/70",
              )}
            >
              {c.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
