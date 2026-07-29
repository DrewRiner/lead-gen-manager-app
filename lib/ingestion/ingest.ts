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
    const decision = await evaluateLead(
      { type: lead.type, callDurationSeconds: null },
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

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(leads)
      .values(values)
      .onConflictDoNothing({
        target: [leads.sourceSystem, leads.externalId],
        where: sql`${leads.externalId} is not null`,
      })
      .returning({ id: leads.id });

    let leadId: string;
    let duplicate: boolean;
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
