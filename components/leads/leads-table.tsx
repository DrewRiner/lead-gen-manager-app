"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";

import { AssignLeadDialog } from "@/components/leads/assign-lead-dialog";
import { LeadOverrideDialog } from "@/components/leads/lead-override-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LeadListRow } from "@/lib/queries/leads";
import { formatDuration, titleCase } from "@/lib/format";
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
            <TableHead>Caller</TableHead>
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
                    <TableCell className="capitalize">{r.type}</TableCell>
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
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={colCount + 1}>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 p-2 text-sm md:grid-cols-4">
                          <Detail label="Source">{titleCase(r.source)}</Detail>
                          <Detail label="Delivery">
                            <StatusBadge status={r.deliveryStatus} />
                          </Detail>
                          <Detail label="Qualified by">
                            {r.qualifiedBy ? titleCase(r.qualifiedBy) : "—"}
                          </Detail>
                          <Detail label="Source system">
                            {r.sourceSystem}
                          </Detail>
                          <Detail label="Caller phone">
                            {formatPhone(r.callerPhone)}
                          </Detail>
                          <Detail label="Caller email">
                            {r.callerEmail ?? "—"}
                          </Detail>
                          <Detail label="Client">
                            {r.clientName ?? "—"}
                          </Detail>
                          <Detail label="Billable reason">
                            {r.billableReason ?? "—"}
                          </Detail>
                          {r.ghlLeadSourceRaw ? (
                            <Detail label="Lead source (raw)">
                              <span className="font-mono text-xs">
                                {r.ghlLeadSourceRaw}
                              </span>
                            </Detail>
                          ) : null}
                          {r.formName ? (
                            <Detail label="Form">{r.formName}</Detail>
                          ) : null}
                          {r.pageUrl ? (
                            <div className="col-span-2 md:col-span-4">
                              <Detail label="Page URL">
                                <span className="break-all font-mono text-xs">
                                  {r.pageUrl}
                                </span>
                              </Detail>
                            </div>
                          ) : null}
                          <div className="col-span-2 md:col-span-4">
                            <Detail label="Message">
                              {r.message ?? "—"}
                            </Detail>
                          </div>
                          {r.recordingUrl ? (
                            <div className="col-span-2 md:col-span-4">
                              <Detail label="Recording">
                                <a
                                  href={r.recordingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  {r.recordingUrl}
                                </a>
                              </Detail>
                            </div>
                          ) : null}
                          <div className="col-span-2 flex flex-wrap items-end gap-2 md:col-span-4">
                            {r.propertyId == null ? (
                              <AssignLeadDialog
                                leadId={r.id}
                                leadSourceRaw={r.ghlLeadSourceRaw}
                                properties={properties}
                                trigger={
                                  <Button
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Assign to property
                                  </Button>
                                }
                              />
                            ) : null}
                            <LeadOverrideDialog
                              leadId={r.id}
                              current={r.billableStatus}
                              trigger={
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Override billable status
                                </Button>
                              }
                            />
                          </div>
                        </div>
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

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="font-medium">{children}</div>
    </div>
  );
}
