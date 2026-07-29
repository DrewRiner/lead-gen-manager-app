"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Phone,
  PhoneIncoming,
  PhoneMissed,
} from "lucide-react";
import { useState } from "react";

import { AssignLeadDialog } from "@/components/leads/assign-lead-dialog";
import { LeadOverrideDialog } from "@/components/leads/lead-override-dialog";
import { NotSpamButton } from "@/components/leads/not-spam-button";
import { SourceBadge } from "@/components/leads/source-badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatDuration, titleCase } from "@/lib/format";
import {
  billableReasonLabel,
  qualifiedByLabel,
  sourceLabel,
  sourceSystemLabel,
} from "@/lib/leads/labels";
import type { LeadListRow } from "@/lib/queries/leads";
import { formatCurrency } from "@/lib/money";
import { formatPhone } from "@/lib/phone";

// The expanded lead record — grouped, plain-language sections. Raw/debug values
// live under a collapsed "Details" toggle.
export function LeadDetailPanel({
  row,
  tz,
  properties,
}: {
  row: LeadListRow;
  tz: string;
  properties: { id: string; name: string }[];
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const isForm = row.type === "form";
  const isCall = row.type === "call";
  const answers =
    row.formAnswers && Object.keys(row.formAnswers).length > 0 ? row.formAnswers : null;

  const when = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: tz,
  }).format(new Date(row.occurredAt));

  return (
    <div className="space-y-5 p-1 text-sm">
      {/* 1. Contact */}
      <Section title="Contact">
        <Field label="Name" value={row.callerName ?? "—"} />
        <Field label="Phone" value={formatPhone(row.callerPhone) ?? "—"} />
        <Field label="Email" value={row.callerEmail ?? "—"} />
      </Section>

      {/* 2. Lead details */}
      <Section title="Lead details">
        <Field
          label="Type"
          value={
            <span className="inline-flex items-center gap-1.5">
              {isCall ? (
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {titleCase(row.type)}
            </span>
          }
        />
        <Field label="Source" value={sourceLabel(row.source)} />
        <Field
          label="Property"
          value={
            row.propertyId ? (
              <Link
                href={`/properties/${row.propertyId}`}
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {row.propertyName}
              </Link>
            ) : (
              <span className="text-orange-600 dark:text-orange-400">Unmatched</span>
            )
          }
        />
        <Field label="Client" value={row.clientName ?? "—"} />
        <Field label="Received" value={when} />
      </Section>

      {/* 3. Form submission (forms only) */}
      {isForm ? (
        <Section title="Form submission">
          {answers ? (
            <dl className="col-span-full space-y-1">
              {Object.entries(answers).map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <dt className="shrink-0 text-muted-foreground">{label}:</dt>
                  <dd className="break-words font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="col-span-full">
              <FieldLabel>Message</FieldLabel>
              <div className="font-medium">{row.message ?? "—"}</div>
            </div>
          )}
        </Section>
      ) : null}

      {/* 4. Billing */}
      <Section title="Billing">
        <Field label="Status" value={<StatusBadge status={row.billableStatus} />} />
        <Field label="Reason" value={billableReasonLabel(row.billableReason)} />
        <Field label="Qualified by" value={qualifiedByLabel(row.qualifiedBy)} />
        <Field label="Delivery" value={<StatusBadge status={row.deliveryStatus} />} />
        <Field
          label="Billed"
          value={<span className="tabular-nums">{formatCurrency(row.billedAmount)}</span>}
        />
        <Field
          label="Estimated value"
          value={<span className="tabular-nums">{formatCurrency(row.estimatedValue)}</span>}
        />
        {isCall ? (
          <>
            <Field label="Duration" value={formatDuration(row.callDurationSeconds)} />
            <Field label="Call" value={<CallOutcome answered={row.callAnswered} />} />
            {row.isRepeatCaller != null ? (
              <Field
                label="Caller"
                value={row.isRepeatCaller ? "Repeat caller" : "First-time caller"}
              />
            ) : null}
          </>
        ) : null}
      </Section>

      {isCall && row.recordingUrl ? (
        <div className="space-y-1">
          <FieldLabel>Recording</FieldLabel>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={row.recordingUrl} className="h-8 w-full max-w-md" />
        </div>
      ) : null}

      {isCall && row.transcript ? (
        <div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowTranscript((v) => !v);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showTranscript ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Transcript
          </button>
          {showTranscript ? (
            <p className="mt-2 whitespace-pre-wrap rounded-md border bg-background p-3 text-sm leading-relaxed">
              {row.transcript}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* 5. Details (collapsed) */}
      <div className="border-t pt-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowDetails((v) => !v);
          }}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {showDetails ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          Details
        </button>
        {showDetails ? (
          <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
            <Field
              label="Source system"
              value={
                <span className="inline-flex items-center gap-2">
                  <SourceBadge sourceSystem={row.sourceSystem} />
                  <span className="text-muted-foreground">
                    {sourceSystemLabel(row.sourceSystem)}
                  </span>
                </span>
              }
            />
            <Field
              label="Lead source (raw)"
              value={<Mono>{row.ghlLeadSourceRaw ?? "—"}</Mono>}
            />
            <Field label="External ID" value={<Mono>{row.externalId ?? "—"}</Mono>} />
            <div className="col-span-full">
              <FieldLabel>Page URL</FieldLabel>
              <div className="break-all font-mono text-xs">{row.pageUrl ?? "—"}</div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-end gap-2 border-t pt-3">
        {row.propertyId == null ? (
          <AssignLeadDialog
            leadId={row.id}
            leadSourceRaw={row.ghlLeadSourceRaw}
            properties={properties}
            trigger={
              <Button size="sm" onClick={(e) => e.stopPropagation()}>
                Assign to property
              </Button>
            }
          />
        ) : null}
        {row.billableStatus === "spam" ? <NotSpamButton leadId={row.id} /> : null}
        <LeadOverrideDialog
          leadId={row.id}
          current={row.billableStatus}
          trigger={
            <Button size="sm" variant="outline" onClick={(e) => e.stopPropagation()}>
              Override billable status
            </Button>
          }
        />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="break-all font-mono text-xs">{children}</span>;
}

/** Answered / Missed indicator (green / red). Null answered -> em dash. */
function CallOutcome({ answered }: { answered: boolean | null }) {
  if (answered == null) return <span className="text-muted-foreground">—</span>;
  return answered ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
      <PhoneIncoming className="h-3 w-3" /> Answered
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
      <PhoneMissed className="h-3 w-3" /> Missed
    </span>
  );
}
