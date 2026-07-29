import { and, eq, sql } from "drizzle-orm";

import { evaluateLead } from "@/lib/billing/evaluate-lead";
import { db } from "@/lib/db";
import { leads, webhookEvents, type NewLead } from "@/lib/db/schema";
import type { MatchStrategy } from "@/lib/ingestion/resolve";
import { resolveProperty } from "@/lib/ingestion/resolve";
import type { CanonicalLead } from "@/lib/ingestion/types";
import { makeSpamDeps } from "@/lib/spam/deps";
import { getAppSettings } from "@/lib/settings";

// ---------------------------------------------------------------------------
// Persist a CanonicalLead: resolve its property, run the billing engine (the
// one and only place billing is decided — CLAUDE.md), and upsert idempotently
// on (source_system, external_id). Unresolved leads are stored 'unmatched'
// with a null property and zero value, to be assigned later from /leads.
// ---------------------------------------------------------------------------

const UNMATCHED_REASON = "unmatched_no_property";
const FALLBACK_TIME_NOTE = "occurred_at defaulted to receipt time";

/** The billable_reason suffix noting the occurred_at fallback, if any. */
function occurredNote(lead: CanonicalLead): string {
  if (!lead.occurredAtFallback) return "";
  return ` (${lead.occurredAtNote ?? FALLBACK_TIME_NOTE})`;
}

export interface IngestResult {
  leadId: string;
  matched: boolean;
  matchStrategy: MatchStrategy | null;
  /** True when the (source_system, external_id) already existed — no new row. */
  duplicate: boolean;
}

/**
 * Ingest one canonical lead.
 *
 * @param webhookEventId  When given, the produced lead is linked back onto that
 *                        webhook_events row and it's stamped processed.
 */
export async function ingestCanonicalLead(
  lead: CanonicalLead,
  webhookEventId?: string,
): Promise<IngestResult> {
  const match = await resolveProperty(lead);

  const fallbackNote = occurredNote(lead);

  let values: NewLead;
  if (match) {
    const { property } = match;
    // Spam-score matched FORM leads only. The scorer's I/O (MX lookup, rate
    // counts) is injected here; it runs inside evaluateLead (the one decider).
    const spam =
      lead.type === "form"
        ? {
            input: {
              email: lead.email,
              phone: lead.phone,
              name: lead.fullName,
              message: lead.message,
              ip: lead.ip,
              rawFields: lead.rawPayload as Record<string, unknown> | null,
            },
            deps: makeSpamDeps(
              { email: lead.email, phone: lead.phone, ip: lead.ip },
              (await getAppSettings()).spamScoreThreshold,
            ),
          }
        : undefined;
    // Calls carry a real duration and take evaluateLead's CALL path (60s
    // threshold / null-duration pending_review). Forms take the form path.
    const decision = await evaluateLead(
      {
        type: lead.type,
        callDurationSeconds: lead.type === "call" ? lead.callDurationSeconds : null,
        form:
          lead.type === "form"
            ? {
                email: lead.email,
                phone: lead.phone,
                name: lead.fullName,
                message: lead.message,
                hasFormAnswers: !!lead.formAnswers,
              }
            : undefined,
      },
      {
        billingType: property.billingType,
        perLeadCallRate: property.perLeadCallRate,
        perLeadFormRate: property.perLeadFormRate,
        estimatedCallValue: property.estimatedCallValue,
        estimatedFormValue: property.estimatedFormValue,
        billableThresholdSeconds: property.billableThresholdSeconds,
      },
      spam,
    );
    values = {
      propertyId: property.id,
      clientId: property.clientId,
      type: lead.type,
      source: lead.source,
      callerName: lead.fullName,
      callerPhone: lead.phone,
      callerEmail: lead.email,
      message: lead.message,
      callDurationSeconds: lead.callDurationSeconds,
      recordingUrl: lead.recordingUrl,
      callAnswered: lead.callAnswered,
      isRepeatCaller: lead.isRepeatCaller,
      transcript: lead.transcript,
      callrailCallId: lead.callrailCallId,
      twilioCallSid: lead.twilioCallSid,
      billableStatus: decision.billableStatus,
      billableReason: (decision.billableReason ?? "") + fallbackNote || null,
      qualifiedBy: decision.qualifiedBy,
      billedAmount: decision.billedAmount,
      estimatedValue: decision.estimatedValue,
      deliveryStatus: "new",
      sourceSystem: lead.provider,
      externalId: lead.externalId,
      ghlContactId: lead.ghlContactId,
      ghlLocationId: lead.ghlLocationId,
      submitterIp: lead.ip,
      ghlLeadSourceRaw: lead.leadSourceRaw,
      pageUrl: lead.pageUrl,
      formName: lead.formName,
      formAnswers: lead.formAnswers as NewLead["formAnswers"],
      rawPayload: lead.rawPayload as NewLead["rawPayload"],
      occurredAt: lead.occurredAt,
    };
  } else {
    // Unresolved: park it as 'unmatched' with zero value.
    values = {
      propertyId: null,
      clientId: null,
      type: lead.type,
      source: lead.source,
      callerName: lead.fullName,
      callerPhone: lead.phone,
      callerEmail: lead.email,
      message: lead.message,
      callDurationSeconds: lead.callDurationSeconds,
      recordingUrl: lead.recordingUrl,
      callAnswered: lead.callAnswered,
      isRepeatCaller: lead.isRepeatCaller,
      transcript: lead.transcript,
      callrailCallId: lead.callrailCallId,
      twilioCallSid: lead.twilioCallSid,
      billableStatus: "unmatched",
      billableReason: UNMATCHED_REASON + fallbackNote,
      qualifiedBy: null,
      billedAmount: "0.00",
      estimatedValue: "0.00",
      deliveryStatus: "new",
      sourceSystem: lead.provider,
      externalId: lead.externalId,
      ghlContactId: lead.ghlContactId,
      ghlLocationId: lead.ghlLocationId,
      submitterIp: lead.ip,
      ghlLeadSourceRaw: lead.leadSourceRaw,
      pageUrl: lead.pageUrl,
      formName: lead.formName,
      formAnswers: lead.formAnswers as NewLead["formAnswers"],
      rawPayload: lead.rawPayload as NewLead["rawPayload"],
      occurredAt: lead.occurredAt,
    };
  }

  // Call providers can deliver the same call id more than once — CallRail fires
  // post_call then call_modified; Twilio may retry a status callback. Those
  // repeat deliveries MERGE their later fields (recording, answered, duration)
  // into the SAME lead — never a new row — preserving the billing decision and
  // any manual override, only filling in the enrichment fields. This is also
  // what makes double-delivery idempotent (returns the existing lead id).
  const merge = lead.provider === "callrail" || lead.provider === "twilio";

  return db.transaction(async (tx) => {
    let leadId: string;
    let duplicate: boolean;

    if (merge) {
      const rows = await tx
        .insert(leads)
        .values(values)
        .onConflictDoUpdate({
          target: [leads.sourceSystem, leads.externalId],
          // Partial unique index predicate — must be targetWhere (NOT where,
          // which onConflictDoUpdate ignores) so ON CONFLICT matches the index.
          targetWhere: sql`${leads.externalId} is not null`,
          set: {
            recordingUrl: sql`coalesce(excluded.recording_url, ${leads.recordingUrl})`,
            transcript: sql`coalesce(excluded.transcript, ${leads.transcript})`,
            callAnswered: sql`coalesce(excluded.call_answered, ${leads.callAnswered})`,
            isRepeatCaller: sql`coalesce(excluded.is_repeat_caller, ${leads.isRepeatCaller})`,
            callDurationSeconds: sql`coalesce(excluded.call_duration_seconds, ${leads.callDurationSeconds})`,
            rawPayload: sql`excluded.raw_payload`,
            updatedAt: sql`now()`,
          },
        })
        // (xmax = 0) is true for a fresh insert, non-zero for an ON CONFLICT update.
        .returning({ id: leads.id, inserted: sql<boolean>`(xmax = 0)` });
      leadId = rows[0]?.id ?? "";
      duplicate = !(rows[0]?.inserted ?? true);
    } else {
      const inserted = await tx
        .insert(leads)
        .values(values)
        .onConflictDoNothing({
          target: [leads.sourceSystem, leads.externalId],
          where: sql`${leads.externalId} is not null`,
        })
        .returning({ id: leads.id });

      if (inserted.length > 0) {
        leadId = inserted[0].id;
        duplicate = false;
      } else {
        // Conflict: the lead already exists. Fetch its id so we can still link
        // the (replayed) webhook event to it.
        const [existing] = await tx
          .select({ id: leads.id })
          .from(leads)
          .where(
            and(
              eq(leads.sourceSystem, lead.provider),
              eq(leads.externalId, lead.externalId),
            ),
          )
          .limit(1);
        leadId = existing?.id ?? "";
        duplicate = true;
      }
    }

    if (webhookEventId && leadId) {
      await tx
        .update(webhookEvents)
        .set({ leadId, processedAt: new Date(), error: null })
        .where(eq(webhookEvents.id, webhookEventId));
    }

    return {
      leadId,
      matched: match != null,
      matchStrategy: match?.strategy ?? null,
      duplicate,
    };
  });
}

/** Guard used by /leads' "assign to property" flow. */
export { UNMATCHED_REASON };

/** Convenience: does the leads table already hold this external id? */
export async function leadExists(
  provider: string,
  externalId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.sourceSystem, provider), eq(leads.externalId, externalId)))
    .limit(1);
  return row != null;
}
