"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
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

  return (
    <div className="overflow-x-auto">
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
                <StatusBadge status={r.status} />
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
  );
}
