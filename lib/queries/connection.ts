import { and, eq, isNull, sql } from "drizzle-orm";

import { connectionStatus } from "@/lib/connection";
import { db } from "@/lib/db";
import { leads, properties } from "@/lib/db/schema";

// Connection = reality. A property is "connected" (green dot) when a REAL
// ingested lead (ghl/callrail/twilio — never manual) arrived in the last 30
// days, OR an admin marked it ready. This module supplies the last-real-lead
// timestamps; lib/connection.ts decides green/red from that + connection_ready.

/** propertyId -> most recent REAL ingested lead timestamp (all-time max). */
export async function getRealLeadMap(): Promise<Map<string, Date>> {
  const rows = await db
    .select({
      propertyId: leads.propertyId,
      lastAt: sql<string>`max(${leads.occurredAt})`,
    })
    .from(leads)
    .where(
      and(
        isNull(leads.deletedAt),
        sql`${leads.propertyId} is not null`,
        sql`${leads.sourceSystem} in ('ghl','callrail','twilio')`,
      ),
    )
    .groupBy(leads.propertyId);

  const map = new Map<string, Date>();
  for (const r of rows) {
    if (r.propertyId && r.lastAt) map.set(r.propertyId, new Date(r.lastAt));
  }
  return map;
}

/** Most recent real ingested lead for a single property, or null. */
export async function getRealLeadAt(propertyId: string): Promise<Date | null> {
  const [row] = await db
    .select({ lastAt: sql<string>`max(${leads.occurredAt})` })
    .from(leads)
    .where(
      and(
        isNull(leads.deletedAt),
        eq(leads.propertyId, propertyId),
        sql`${leads.sourceSystem} in ('ghl','callrail','twilio')`,
      ),
    );
  return row?.lastAt ? new Date(row.lastAt) : null;
}

export interface ConnectionSummary {
  connected: number;
  notConnected: number;
  total: number;
}

/** Rollup for the dashboard's quiet "N properties not connected" line. */
export async function getConnectionSummary(): Promise<ConnectionSummary> {
  const [props, realLeads] = await Promise.all([
    db
      .select({ id: properties.id, connectionReady: properties.connectionReady })
      .from(properties)
      .where(isNull(properties.deletedAt)),
    getRealLeadMap(),
  ]);

  let connected = 0;
  for (const p of props) {
    const status = connectionStatus({
      connectionReady: p.connectionReady,
      lastRealLeadAt: realLeads.get(p.id) ?? null,
    });
    if (status.connected) connected += 1;
  }
  return { connected, notConnected: props.length - connected, total: props.length };
}
