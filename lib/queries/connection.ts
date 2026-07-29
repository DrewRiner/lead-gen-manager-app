import { isNull } from "drizzle-orm";

import { isConnected } from "@/lib/connection";
import { db } from "@/lib/db";
import { properties } from "@/lib/db/schema";

// Connection rollup across all live properties, for the dashboard's quiet
// "N properties not connected" line.

export interface ConnectionSummary {
  connected: number;
  notConnected: number;
  total: number;
}

export async function getConnectionSummary(): Promise<ConnectionSummary> {
  const rows = await db
    .select({ ghlLeadSource: properties.ghlLeadSource })
    .from(properties)
    .where(isNull(properties.deletedAt));

  let connected = 0;
  for (const r of rows) if (isConnected(r)) connected += 1;
  return { connected, notConnected: rows.length - connected, total: rows.length };
}
