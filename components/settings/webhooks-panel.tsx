"use client";

import { useRouter } from "next/navigation";
import { Check, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { AssignLeadDialog } from "@/components/leads/assign-lead-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  regenerateWebhookSecret,
  replayWebhookEvent,
} from "@/lib/actions/webhooks";
import { PLATFORM } from "@/lib/config";
import {
  computeRoutingStatuses,
  type RoutingStatus,
} from "@/lib/routing-status";
import { formatPhone } from "@/lib/phone";
import type {
  PropertyLeadSourceRow,
  UnmatchedLeadRow,
  WebhookEventRow,
} from "@/lib/queries/webhooks";
import { cn } from "@/lib/utils";

export function WebhooksPanel({
  webhookUrl,
  callrailUrl,
  secret,
  leadSources,
  unmatchedLeads,
  events,
  tz,
}: {
  webhookUrl: string;
  callrailUrl: string;
  secret: string | null;
  leadSources: PropertyLeadSourceRow[];
  unmatchedLeads: UnmatchedLeadRow[];
  events: WebhookEventRow[];
  tz: string;
}) {
  const fmt = (d: Date | null) =>
    d
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: tz,
        }).format(new Date(d))
      : "—";

  // Duplicate detection is case-insensitive/trimmed — the same way routing
  // matches — so it catches "Acme" vs "acme" collisions the DB unique index
  // (case-sensitive) would miss.
  const statusByProperty = useMemo(
    () => computeRoutingStatuses(leadSources),
    [leadSources],
  );

  const missing = leadSources.filter(
    (p) => statusByProperty.get(p.id) === "missing",
  ).length;
  const duplicate = leadSources.filter(
    (p) => statusByProperty.get(p.id) === "duplicate",
  ).length;

  // Property options for the "assign to property" dropdown on unmatched leads.
  const assignableProperties = leadSources.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="space-y-6">
      {/* Endpoint + secret */}
      <div className="space-y-4">
        <Labeled
          label="Form endpoint URL"
          hint={`Point the ${PLATFORM.name} workflow's webhook action here (POST).`}
        >
          <CopyRow value={webhookUrl} mono />
        </Labeled>

        <Labeled
          label="CallRail endpoint URL"
          hint="Add this as a CallRail webhook (post_call and call_modified). Signed with CALLRAIL_WEBHOOK_SECRET."
        >
          <CopyRow value={callrailUrl} mono />
        </Labeled>

        <Labeled
          label="Shared secret"
          hint={`Send it as the "X-Webhook-Secret" header on every request.`}
        >
          <SecretField secret={secret} />
        </Labeled>
      </div>

      {/* Routing table — the source of truth for what GHL forms must send */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Routing table</h3>
          <div className="flex items-center gap-3 text-xs font-medium">
            {missing > 0 ? (
              <span className="text-red-600 dark:text-red-400">
                {missing} missing
              </span>
            ) : null}
            {duplicate > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">
                {duplicate} duplicate
              </span>
            ) : null}
            {missing === 0 && duplicate === 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                All mapped
              </span>
            ) : null}
          </div>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          This is exactly what each {PLATFORM.name} form must send in its{" "}
          <strong>Lead Source</strong> hidden field. Copy the value and paste it
          into the matching form. Matching is case-insensitive and trimmed.{" "}
          Calls route by the property&rsquo;s <strong>tracking number</strong>{" "}
          instead — a property in red has no tracking number and can&rsquo;t
          receive CallRail calls.
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Lead Source</TableHead>
                <TableHead>Tracking number</TableHead>
                <TableHead>Short code</TableHead>
                <TableHead>Form ID</TableHead>
                <TableHead>Domain</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadSources.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <RoutingStatusBadge
                      status={statusByProperty.get(p.id) ?? "missing"}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    {p.ghlLeadSource ? (
                      <InlineCopy value={p.ghlLeadSource} />
                    ) : (
                      <span className="text-xs font-medium text-red-600 dark:text-red-400">
                        not set
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.trackingPhone ? (
                      <span className="font-mono text-xs">
                        {formatPhone(p.trackingPhone)}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-red-600 dark:text-red-400">
                        no tracking #
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.shortCode ? (
                      <InlineCopy value={p.shortCode} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.ghlFormId ? (
                      <span className="font-mono text-xs">{p.ghlFormId}</span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.domain ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Recent unmatched leads — what GHL actually sent vs what's expected */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Recent unmatched leads</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          The last {unmatchedLeads.length} leads that arrived without a matching
          property, with the raw Lead Source each one carried. Compare it against
          the routing table above to spot a mismatch, then assign.
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Raw Lead Source sent</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Assign</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unmatchedLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No unmatched leads. Everything is routing cleanly.
                  </TableCell>
                </TableRow>
              ) : (
                unmatchedLeads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {fmt(l.occurredAt)}
                    </TableCell>
                    <TableCell>
                      {l.ghlLeadSourceRaw ? (
                        <span className="font-mono text-xs">
                          {l.ghlLeadSourceRaw}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          (none sent)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.callerName ?? l.callerEmail ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <AssignLeadDialog
                        leadId={l.id}
                        leadSourceRaw={l.ghlLeadSourceRaw}
                        properties={assignableProperties}
                        trigger={
                          <Button size="sm" variant="outline">
                            Assign to property
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Recent events */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Recent webhook events</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Last {events.length} inbound requests. Replay re-runs ingestion with
          the stored payload — safe to retry after fixing a Lead Source.
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Auth</TableHead>
                <TableHead>Lead Source</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="text-right">Replay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No webhook events yet.
                  </TableCell>
                </TableRow>
              ) : (
                events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {fmt(e.createdAt)}
                    </TableCell>
                    <TableCell>
                      {e.authValid ? (
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          valid
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-red-600 dark:text-red-400">
                          rejected
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.leadSourceRaw ?? "—"}
                    </TableCell>
                    <TableCell>
                      <EventResult event={e} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ReplayButton eventId={e.id} disabled={!e.authValid} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

const ROUTING_BADGE: Record<
  RoutingStatus,
  { label: string; cls: string; title: string }
> = {
  mapped: {
    label: "Mapped",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    title: "Lead Source is set and unique — routes cleanly.",
  },
  missing: {
    label: "Missing",
    cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    title:
      "No Lead Source set — can only route by form id or page url fallback.",
  },
  duplicate: {
    label: "Duplicate",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    title:
      "Another property uses the same Lead Source — inbound leads route ambiguously.",
  },
};

function RoutingStatusBadge({ status }: { status: RoutingStatus }) {
  const b = ROUTING_BADGE[status];
  return (
    <span
      title={b.title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        b.cls,
      )}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {b.label}
    </span>
  );
}

function EventResult({ event }: { event: WebhookEventRow }) {
  if (event.error) {
    return (
      <span className="text-xs font-medium text-red-600 dark:text-red-400">
        {event.error}
      </span>
    );
  }
  if (event.leadId) {
    return (
      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
        lead created
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

function Labeled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium">{label}</p>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SecretField({ secret }: { secret: string | null }) {
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  const [pending, startTransition] = useTransition();

  function onRegenerate() {
    if (
      !window.confirm(
        `Regenerate the webhook secret? Every ${PLATFORM.name} form still using the old secret will stop working until you paste in the new value.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      await regenerateWebhookSecret();
      setRevealed(true);
      router.refresh();
    });
  }

  if (!secret) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">No secret set.</span>
        <Button size="sm" onClick={onRegenerate} disabled={pending}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Generate secret
        </Button>
      </div>
    );
  }

  const masked = "•".repeat(24);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-xs">
        {revealed ? secret : masked}
      </code>
      <Button size="icon" variant="outline" onClick={() => setRevealed((v) => !v)} title={revealed ? "Hide" : "Reveal"}>
        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
      <CopyButton value={secret} />
      <Button size="sm" variant="outline" onClick={onRegenerate} disabled={pending}>
        <RefreshCw className="mr-2 h-3.5 w-3.5" /> Regenerate
      </Button>
    </div>
  );
}

function CopyRow({ value, mono }: { value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <code
        className={`flex-1 truncate rounded-md border bg-muted px-3 py-2 text-xs ${mono ? "font-mono" : ""}`}
      >
        {value}
      </code>
      <CopyButton value={value} />
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="icon"
      variant="outline"
      title="Copy"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function InlineCopy({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded font-mono text-xs hover:text-primary"
      title="Copy"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {value}
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600" />
      ) : (
        <Copy className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}

function ReplayButton({ eventId, disabled }: { eventId: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onReplay() {
    setMsg(null);
    startTransition(async () => {
      const res = await replayWebhookEvent(eventId);
      setMsg(res.ok ? (res.message ?? "Replayed.") : res.error);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" onClick={onReplay} disabled={pending || disabled}>
        {pending ? "Replaying…" : "Replay"}
      </Button>
      {msg ? (
        <span className="max-w-[16rem] text-right text-[11px] text-muted-foreground">
          {msg}
        </span>
      ) : null}
    </div>
  );
}
