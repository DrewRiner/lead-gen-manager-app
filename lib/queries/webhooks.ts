import { asc, desc, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { properties, webhookEvents } from "@/lib/db/schema";

export interface WebhookEventRow {
  id: string;
  provider: string;
  eventType: string | null;
  authValid: boolean;
  error: string | null;
  leadId: string | null;
  processedAt: Date | null;
  createdAt: Date;
  /** Best-effort lead source pulled out of the raw payload, for the table. */
  leadSourceRaw: string | null;
}

/** Most-recent inbound webhook events (default 100) for the Settings history. */
export async function getWebhookEvents(limit = 100): Promise<WebhookEventRow[]> {
  const rows = await db
    .select({
      id: webhookEvents.id,
      provider: webhookEvents.provider,
      eventType: webhookEvents.eventType,
      authValid: webhookEvents.authValid,
      error: webhookEvents.error,
      leadId: webhookEvents.leadId,
      processedAt: webhookEvents.processedAt,
      createdAt: webhookEvents.createdAt,
      rawPayload: webhookEvents.rawPayload,
    })
    .from(webhookEvents)
    .orderBy(desc(webhookEvents.createdAt))
    .limit(limit);

  return rows.map((r) => {
    const p = (r.rawPayload ?? {}) as Record<string, unknown>;
    const src = p.lead_source ?? p.leadSource ?? p.source;
    return {
      id: r.id,
      provider: r.provider,
      eventType: r.eventType,
      authValid: r.authValid,
      error: r.error,
      leadId: r.leadId,
      processedAt: r.processedAt,
      createdAt: r.createdAt,
      leadSourceRaw: typeof src === "string" ? src : null,
    };
  });
}

export interface PropertyLeadSourceRow {
  id: string;
  name: string;
  status: string;
  ghlLeadSource: string | null;
  ghlFormId: string | null;
  domain: string | null;
}

/** Every live property's ingestion keys, for the Settings mapping table. */
export async function getPropertyLeadSources(): Promise<PropertyLeadSourceRow[]> {
  return db
    .select({
      id: properties.id,
      name: properties.name,
      status: properties.status,
      ghlLeadSource: properties.ghlLeadSource,
      ghlFormId: properties.ghlFormId,
      domain: properties.domain,
    })
    .from(properties)
    .where(isNull(properties.deletedAt))
    .orderBy(asc(properties.name));
}
