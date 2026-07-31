"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight, FileText, Phone, PhoneMissed } from "lucide-react";
import { Fragment, useState } from "react";

import { LeadDetailPanel } from "@/components/leads/lead-detail-panel";
import { SourceBadge } from "@/components/leads/source-badge";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LeadListRow } from "@/lib/queries/leads";
import { formatDuration } from "@/lib/format";
import { formatCurrency } from "@/lib/money";
import { formatPhone } from "@/lib/phone";

export function LeadsTable({
  rows,
  tz,
  hideProperty = false,
  properties = [],
}: {
  rows: LeadListRow[];
  tz: string;
  hideProperty?: boolean;
  /** Property options for the "assign to property" flow on unmatched leads. */
  properties?: { id: string; name: string }[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
    }).format(new Date(d));

  const colCount = hideProperty ? 8 : 9;

  return (
    <>
    {/* Desktop: full table. Hidden below lg in favour of the card list. */}
    <div className="hidden overflow-x-auto lg:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Date</TableHead>
            {hideProperty ? null : <TableHead>Property</TableHead>}
            <TableHead>Type</TableHead>
            <TableHead>Lead</TableHead>
            <TableHead className="text-right">Duration</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Billed</TableHead>
            <TableHead className="text-right">Est. value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={colCount + 1}
                className="py-10 text-center text-muted-foreground"
              >
                No leads match these filters.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => {
              const isOpen = expanded === r.id;
              return (
                <Fragment key={r.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                  >
                    <TableCell>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {fmt(r.occurredAt)}
                    </TableCell>
                    {hideProperty ? null : (
                      <TableCell className="font-medium">
                        {r.propertyId ? (
                          <Link
                            href={`/properties/${r.propertyId}`}
                            className="hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.propertyName}
                          </Link>
                        ) : (
                          <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                            Unmatched
                          </span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {r.type === "call" ? (
                          <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="capitalize">{r.type}</span>
                        {r.type === "call" && r.callAnswered === false ? (
                          <span
                            title="Missed call"
                            className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-400"
                          >
                            <PhoneMissed className="h-3 w-3" /> Missed
                          </span>
                        ) : null}
                        <SourceBadge sourceSystem={r.sourceSystem} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.callerName ?? formatPhone(r.callerPhone) ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.type === "call" ? formatDuration(r.callDurationSeconds) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.billableStatus} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.billedAmount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.estimatedValue)}
                    </TableCell>
                  </TableRow>
                  {isOpen ? (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={colCount + 1}>
                        <LeadDetailPanel row={r} tz={tz} properties={properties} />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>

    {/* Mobile: card list. Tap a card to expand the same detail panel. The
        property link lives inside the expanded detail to avoid nesting a link
        in the row button. */}
    <div className="divide-y lg:hidden">
      {rows.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">
          No leads match these filters.
        </div>
      ) : (
        rows.map((r) => {
          const isOpen = expanded === r.id;
          const caller = r.callerName ?? formatPhone(r.callerPhone) ?? "—";
          return (
            <div key={r.id}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : r.id)}
                aria-expanded={isOpen}
                className="flex w-full items-start gap-3 px-4 py-3 text-left"
              >
                <span className="mt-0.5 shrink-0">
                  {r.type === "call" ? (
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{caller}</span>
                    {r.type === "call" && r.callAnswered === false ? (
                      <PhoneMissed
                        className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400"
                        aria-label="Missed call"
                      />
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                    <span className="whitespace-nowrap">{fmt(r.occurredAt)}</span>
                    <span aria-hidden>·</span>
                    {r.propertyId ? (
                      <span className="truncate">{r.propertyName}</span>
                    ) : (
                      <span className="font-medium text-orange-600 dark:text-orange-400">
                        Unmatched
                      </span>
                    )}
                    {r.type === "call" ? (
                      <span className="ml-auto tabular-nums">
                        {formatDuration(r.callDurationSeconds)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <StatusBadge status={r.billableStatus} className="mt-0.5 shrink-0" />
                {isOpen ? (
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
              {isOpen ? (
                <div className="bg-muted/30 px-4 py-3">
                  <LeadDetailPanel row={r} tz={tz} properties={properties} />
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
    </>
  );
}
