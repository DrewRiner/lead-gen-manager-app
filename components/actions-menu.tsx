"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// One reusable "Actions" dropdown for page headers. Groups are separated by
// dividers with an optional heading; destructive items get danger styling and
// should be placed last in their group. Empty groups are omitted. Keyboard
// accessibility comes from the underlying Radix dropdown-menu primitive.
export interface ActionItem {
  key: string;
  label: string;
  icon?: ReactNode;
  /** Link item (navigates). Mutually exclusive with onSelect. */
  href?: string;
  /** Handler item (e.g. opens a dialog or runs a server action). */
  onSelect?: () => void;
  /** Destructive — red/danger styling; keep last in its group. */
  danger?: boolean;
  disabled?: boolean;
}

export interface ActionGroup {
  label?: string;
  items: ActionItem[];
}

function Inner({ icon, label }: { icon?: ReactNode; label: string }) {
  return (
    <>
      {icon ? <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">{icon}</span> : null}
      {label}
    </>
  );
}

export function ActionsMenu({
  label = "Actions",
  groups,
  align = "end",
}: {
  label?: string;
  groups: ActionGroup[];
  align?: "start" | "end";
}) {
  const visible = groups.filter((g) => g.items.length > 0);
  if (visible.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {label}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-60">
        {visible.map((g, gi) => (
          <Fragment key={gi}>
            {gi > 0 ? <DropdownMenuSeparator /> : null}
            {g.label ? (
              <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {g.label}
              </DropdownMenuLabel>
            ) : null}
            {g.items.map((it) => {
              const danger = it.danger
                ? "text-destructive focus:text-destructive focus:bg-destructive/10"
                : undefined;
              return it.href ? (
                <DropdownMenuItem key={it.key} asChild disabled={it.disabled} className={danger}>
                  <Link href={it.href}>
                    <Inner icon={it.icon} label={it.label} />
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  key={it.key}
                  disabled={it.disabled}
                  className={cn("cursor-pointer", danger)}
                  onSelect={() => it.onSelect?.()}
                >
                  <Inner icon={it.icon} label={it.label} />
                </DropdownMenuItem>
              );
            })}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
