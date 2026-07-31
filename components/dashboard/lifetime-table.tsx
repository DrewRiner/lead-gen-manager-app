"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo, useState } from "react";

import { PropertyStatusBadge } from "@/components/properties/property-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, titleCase } from "@/lib/format";
import { formatCurrency, sumMoney, toMoneyNumber } from "@/lib/money";
import type { LifetimePropertyRow } from "@/lib/queries/lifetime";
import { cn } from "@/lib/utils";

type SortKey =
  | "name"
  | "niche"
  | "city"
  | "status"
  | "billingType"
  | "totalLeads"
  | "billableLeads"
  | "actualRevenue"
  | "potentialRevenue"
  | "difference"
  | "multiple";

const NUMERIC: Set<SortKey> = new Set([
  "totalLeads",
  "billableLeads",
  "actualRevenue",
  "potentialRevenue",
  "difference",
  "multiple",
]);

const BILLING_LABEL: Record<string, string> = {
  flat_monthly: "Flat monthly",
  per_lead: "Per lead",
  hybrid: "Hybrid",
};

function fmtMultiple(m: number | null): string {
  return m == null ? "—" : `${(Math.round(m * 10) / 10).toFixed(1)}x`;
}

export function LifetimeTable({ rows }: { rows: LifetimePropertyRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("difference");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const val = (r: LifetimePropertyRow, k: SortKey): number | string => {
      switch (k) {
        case "totalLeads":
          return r.totalLeads;
        case "billableLeads":
          return r.billableLeads;
        case "actualRevenue":
          return toMoneyNumber(r.actualRevenue);
        case "potentialRevenue":
          return toMoneyNumber(r.potentialRevenue);
        case "difference":
          return toMoneyNumber(r.difference);
        case "multiple":
          return r.multiple ?? -1;
        default:
          return String(r[k] ?? "").toLowerCase();
      }
    };
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = val(a, sortKey);
      const bv = val(b, sortKey);
      let cmp: number;
      if (typeof av === "string" && typeof bv === "string") cmp = av.localeCompare(bv);
      else cmp = (av as number) - (bv as number);
      if (cmp === 0) cmp = a.name.localeCompare(b.name);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const totals = useMemo(() => {
    const actual = sumMoney(rows.map((r) => r.actualRevenue));
    const potential = sumMoney(rows.map((r) => r.potentialRevenue));
    const difference = sumMoney([potential, -toMoneyNumber(actual)]);
    const actualNum = toMoneyNumber(actual);
    return {
      totalLeads: rows.reduce((s, r) => s + r.totalLeads, 0),
      billableLeads: rows.reduce((s, r) => s + r.billableLeads, 0),
      actual,
      potential,
      difference,
      multiple: actualNum > 0 ? toMoneyNumber(potential) / actualNum : null,
    };
  }, [rows]);

  function toggle(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(NUMERIC.has(k) ? "desc" : "asc");
    }
  }

  const H = ({ label, k, numeric }: { label: string; k: SortKey; numeric?: boolean }) => (
    <TableHead className={numeric ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => toggle(k)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          numeric && "flex-row-reverse",
          sortKey === k ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {sortKey === k ? (
          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : null}
      </button>
    </TableHead>
  );

  const MOBILE_SORTS: { k: SortKey; label: string }[] = [
    { k: "difference", label: "Difference" },
    { k: "actualRevenue", label: "Actual" },
    { k: "potentialRevenue", label: "Potential" },
    { k: "multiple", label: "Multiple" },
    { k: "totalLeads", label: "Leads" },
    { k: "name", label: "Name" },
  ];

  return (
    <>
    {/* Desktop: full table. Cards below lg. */}
    <div className="hidden overflow-x-auto lg:block">
      <Table>
        <TableHeader>
          <TableRow>
            <H label="Property" k="name" />
            <H label="Niche" k="niche" />
            <H label="City" k="city" />
            <H label="Status" k="status" />
            <H label="Billing" k="billingType" />
            <H label="Leads" k="totalLeads" numeric />
            <H label="Billable" k="billableLeads" numeric />
            <H label="Actual" k="actualRevenue" numeric />
            <H label="Potential" k="potentialRevenue" numeric />
            <H label="Difference" k="difference" numeric />
            <H label="Multiple" k="multiple" numeric />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => (
            <TableRow key={r.propertyId}>
              <TableCell className="font-medium">
                <Link href={`/properties/${r.propertyId}`} className="hover:underline">
                  {r.name}
                </Link>
              </TableCell>
              <TableCell className="capitalize text-muted-foreground">{r.niche ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{r.city ?? "—"}</TableCell>
              <TableCell>
                <PropertyStatusBadge status={r.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {BILLING_LABEL[r.billingType] ?? titleCase(r.billingType)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(r.totalLeads)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(r.billableLeads)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(r.actualRevenue)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(r.potentialRevenue)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatCurrency(r.difference)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMultiple(r.multiple)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={5} className="font-semibold">
              Totals ({rows.length})
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatNumber(totals.totalLeads)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatNumber(totals.billableLeads)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(totals.actual)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(totals.potential)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(totals.difference)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{fmtMultiple(totals.multiple)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>

    {/* Mobile/tablet: card list. Niche, city, and billing move behind the tap
        into the property; sorted by the same key as the table. */}
    <div className="space-y-3 px-4 lg:hidden">
      <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
        <span className="shrink-0 text-xs font-medium text-muted-foreground">Sort</span>
        {MOBILE_SORTS.map((o) => (
          <button
            key={o.k}
            type="button"
            onClick={() => toggle(o.k)}
            className={cn(
              "inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-md border px-2.5 text-xs",
              sortKey === o.k
                ? "border-foreground/30 bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {o.label}
            {sortKey === o.k ? (
              sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            ) : null}
          </button>
        ))}
      </div>

      {sorted.map((r) => (
        <div key={r.propertyId} className="rounded-xl border p-4">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/properties/${r.propertyId}`}
              className="min-w-0 truncate py-0.5 font-medium leading-snug hover:underline"
            >
              {r.name}
            </Link>
            <PropertyStatusBadge status={r.status} className="mt-0.5 shrink-0" />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatNumber(r.totalLeads)} leads · {formatNumber(r.billableLeads)} billable
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <LStat label="Actual" value={formatCurrency(r.actualRevenue)} />
            <LStat label="Potential" value={formatCurrency(r.potentialRevenue)} />
            <LStat label="Difference" value={formatCurrency(r.difference)} strong />
            <LStat label="Multiple" value={fmtMultiple(r.multiple)} />
          </div>
        </div>
      ))}

      <div className="rounded-xl border bg-muted/30 p-4">
        <div className="text-xs font-semibold text-muted-foreground">
          Totals ({rows.length})
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <LStat label="Actual" value={formatCurrency(totals.actual)} />
          <LStat label="Potential" value={formatCurrency(totals.potential)} />
          <LStat label="Difference" value={formatCurrency(totals.difference)} strong />
          <LStat label="Multiple" value={fmtMultiple(totals.multiple)} />
        </div>
      </div>
    </div>
    </>
  );
}

function LStat({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-md bg-muted/50 px-2.5 py-1.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "truncate tabular-nums",
          strong ? "text-sm font-semibold" : "text-sm font-medium",
        )}
      >
        {value}
      </div>
    </div>
  );
}
