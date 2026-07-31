"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight, FileText, Phone, PhoneMissed } from "lucide-react";
import { Fragment, useState } from "react";

import { LeadDetailPanel } from "@/components/leads/lead-detail-panel";
import { SourceBadge } from "@/components/leads/source-badge";
import { StatusBadge } from "@/components/status-badge";
import { isPendingEnrichment } from "@/lib/leads/pending-enrichment";
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
    <div className="overflow-x-auto">
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
              const pending = isPendingEnrichment(r);
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
                      {pending ? (
                        <span className="text-muted-foreground">Awaiting call data</span>
                      ) : r.type === "call" ? (
                        formatDuration(r.callDurationSeconds)
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {pending ? (
                        <span
                          title="Call data still arriving from CallRail — status finalizes once the call ends."
                          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        >
                          Pending
                        </span>
                      ) : (
                        <StatusBadge status={r.billableStatus} />
                      )}
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
  );
}
