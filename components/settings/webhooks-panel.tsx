"use client";

import { useRouter } from "next/navigation";
import { Check, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

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
import {
  regenerateWebhookSecret,
  replayWebhookEvent,
} from "@/lib/actions/webhooks";
import type { PropertyLeadSourceRow, WebhookEventRow } from "@/lib/queries/webhooks";

export function WebhooksPanel({
  webhookUrl,
  secret,
  leadSources,
  events,
  tz,
}: {
  webhookUrl: string;
  secret: string | null;
  leadSources: PropertyLeadSourceRow[];
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

  const missing = leadSources.filter((p) => !p.ghlLeadSource).length;

  return (
    <div className="space-y-6">
      {/* Endpoint + secret */}
      <div className="space-y-4">
        <Labeled label="Endpoint URL" hint="Point the GoHighLevel workflow's webhook action here (POST).">
          <CopyRow value={webhookUrl} mono />
        </Labeled>

        <Labeled
          label="Shared secret"
          hint={`Send it as the "X-Webhook-Secret" header on every request.`}
        >
          <SecretField secret={secret} />
        </Labeled>
      </div>

      {/* Property -> Lead Source mapping */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Property Lead Source values</h3>
          {missing > 0 ? (
            <span className="text-xs font-medium text-red-600 dark:text-red-400">
              {missing} without a Lead Source
            </span>
          ) : null}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Put the exact Lead Source value into each GHL form&rsquo;s hidden
          field. A blank value can&rsquo;t be matched by lead source.
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Lead Source</TableHead>
                <TableHead>Form ID</TableHead>
                <TableHead>Domain</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadSources.map((p) => (
                <TableRow key={p.id}>
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
        "Regenerate the webhook secret? Every GoHighLevel form still using the old secret will stop working until you paste in the new value.",
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
