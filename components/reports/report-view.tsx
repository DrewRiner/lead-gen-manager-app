"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { useMemo, useState } from "react";

import { HealthDot, MomentumArrow } from "@/components/producing-health";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { HealthSignal, Momentum } from "@/lib/producing-health";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toCsv } from "@/lib/csv";
import { formatNumber, titleCase } from "@/lib/format";
import { formatCurrency, sumMoney, toMoneyNumber } from "@/lib/money";
import type { MonthlyReportRow } from "@/lib/queries/metrics";
import { cn } from "@/lib/utils";

type SortKey =
  | "name"
  | "niche"
  | "city"
  | "status"
  | "billingType"
  | "calls"
  | "forms"
  | "total"
  | "billable"
  | "estimatedValue"
  | "actualRevenue"
  | "gap";

const NUMERIC: Set<SortKey> = new Set([
  "calls",
  "forms",
  "total",
  "billable",
  "estimatedValue",
  "actualRevenue",
  "gap",
]);

const BILLING_LABEL: Record<string, string> = {
  flat_monthly: "Flat monthly",
  per_lead: "Per lead",
  hybrid: "Hybrid",
};

export interface ReportRowHealth {
  signal: HealthSignal;
  momentum: Momentum;
  reason: string | null;
}

export function ReportView({
  rows,
  monthLabel,
  monthKey,
  health = {},
}: {
  rows: MonthlyReportRow[];
  monthLabel: string;
  monthKey: string;
  /** Current producing-health per property id (independent of the report month). */
  health?: Record<string, ReportRowHealth>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("estimatedValue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [unrentedOnly, setUnrentedOnly] = useState(false);

  const filtered = useMemo(
    () => (unrentedOnly ? rows.filter((r) => !r.isRented) : rows),
    [rows, unrentedOnly],
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp: number;
      if (NUMERIC.has(sortKey)) {
        const av = numeric(a, sortKey);
        const bv = numeric(b, sortKey);
        cmp = av - bv;
      } else {
        cmp = String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totals = useMemo(
    () => ({
      calls: sorted.reduce((s, r) => s + r.calls, 0),
      forms: sorted.reduce((s, r) => s + r.forms, 0),
      total: sorted.reduce((s, r) => s + r.total, 0),
      billable: sorted.reduce((s, r) => s + r.billable, 0),
      estimatedValue: sumMoney(sorted.map((r) => r.estimatedValue)),
      actualRevenue: sumMoney(sorted.map((r) => r.actualRevenue)),
      gap: sumMoney(sorted.map((r) => r.gap)),
      leads: sorted.reduce((s, r) => s + r.total, 0),
    }),
    [sorted],
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(NUMERIC.has(key) ? "desc" : "asc");
    }
  }

  function exportCsv() {
    const headers = [
      { key: "name", label: "Property" },
      { key: "niche", label: "Niche" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "status", label: "Status" },
      { key: "billingType", label: "Billing Type" },
      { key: "calls", label: "Calls" },
      { key: "forms", label: "Forms" },
      { key: "total", label: "Total Leads" },
      { key: "billable", label: "Billable" },
      { key: "estimatedValue", label: "Estimated Value" },
      { key: "actualRevenue", label: "Actual Revenue" },
      { key: "gap", label: "Gap" },
    ];
    const records = sorted.map((r) => ({
      name: r.name,
      niche: r.niche ?? "",
      city: r.city ?? "",
      state: r.state ?? "",
      status: r.status,
      billingType: r.billingType,
      calls: r.calls,
      forms: r.forms,
      total: r.total,
      billable: r.billable,
      estimatedValue: r.estimatedValue,
      actualRevenue: r.actualRevenue,
      gap: r.gap,
    }));
    const csv = toCsv(headers, records);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${monthKey}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total leads" value={formatNumber(totals.leads)} />
        <StatCard
          label="Estimated value"
          value={formatCurrency(totals.estimatedValue)}
        />
        <StatCard
          label="Actual revenue"
          value={formatCurrency(totals.actualRevenue)}
        />
        <StatCard label="Gap" value={formatCurrency(totals.gap)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="unrented"
            checked={unrentedOnly}
            onCheckedChange={(v) => setUnrentedOnly(v === true)}
          />
          <Label htmlFor="unrented" className="cursor-pointer text-sm">
            Show only unrented properties
          </Label>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium">Producing health (current):</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Confirmed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
          Overstated
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
          Understated (ready to sell)
        </span>
        <span>· Arrow = 3-month billable trend</span>
      </div>

      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Property" k="name" {...{ sortKey, sortDir, toggleSort }} />
                <SortHead label="Niche" k="niche" {...{ sortKey, sortDir, toggleSort }} />
                <SortHead label="City" k="city" {...{ sortKey, sortDir, toggleSort }} />
                <SortHead label="Status" k="status" {...{ sortKey, sortDir, toggleSort }} />
                <SortHead label="Billing" k="billingType" {...{ sortKey, sortDir, toggleSort }} />
                <SortHead label="Calls" k="calls" numeric {...{ sortKey, sortDir, toggleSort }} />
                <SortHead label="Forms" k="forms" numeric {...{ sortKey, sortDir, toggleSort }} />
                <SortHead label="Total" k="total" numeric {...{ sortKey, sortDir, toggleSort }} />
                <SortHead label="Billable" k="billable" numeric {...{ sortKey, sortDir, toggleSort }} />
                <SortHead label="Est. value" k="estimatedValue" numeric {...{ sortKey, sortDir, toggleSort }} />
                <SortHead label="Revenue" k="actualRevenue" numeric {...{ sortKey, sortDir, toggleSort }} />
                <SortHead label="Gap" k="gap" numeric {...{ sortKey, sortDir, toggleSort }} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No properties to show for {monthLabel}.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((r) => {
                  const h = health[r.propertyId];
                  return (
                  <TableRow key={r.propertyId}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/properties/${r.propertyId}`}
                        className="hover:underline"
                      >
                        {r.name}
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {r.niche ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.city ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        {h ? <HealthDot signal={h.signal} reason={h.reason} /> : null}
                        <StatusBadge status={r.status} />
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {BILLING_LABEL[r.billingType] ?? titleCase(r.billingType)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(r.calls)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(r.forms)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(r.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="inline-flex items-center justify-end gap-1">
                        {formatNumber(r.billable)}
                        {h ? <MomentumArrow momentum={h.momentum} /> : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(r.estimatedValue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.actualRevenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(r.gap)}
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="font-semibold">
                  Totals ({sorted.length}{" "}
                  {sorted.length === 1 ? "property" : "properties"})
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatNumber(totals.calls)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatNumber(totals.forms)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatNumber(totals.total)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatNumber(totals.billable)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatCurrency(totals.estimatedValue)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatCurrency(totals.actualRevenue)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatCurrency(totals.gap)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}

function numeric(r: MonthlyReportRow, key: SortKey): number {
  switch (key) {
    case "calls":
      return r.calls;
    case "forms":
      return r.forms;
    case "total":
      return r.total;
    case "billable":
      return r.billable;
    case "estimatedValue":
      return toMoneyNumber(r.estimatedValue);
    case "actualRevenue":
      return toMoneyNumber(r.actualRevenue);
    case "gap":
      return toMoneyNumber(r.gap);
    default:
      return 0;
  }
}

function SortHead({
  label,
  k,
  numeric: isNumeric = false,
  sortKey,
  sortDir,
  toggleSort,
}: {
  label: string;
  k: SortKey;
  numeric?: boolean;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  toggleSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <TableHead className={isNumeric ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          isNumeric && "flex-row-reverse",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : null}
      </button>
    </TableHead>
  );
}
