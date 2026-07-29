import { isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { properties } from "@/lib/db/schema";
import { matchProperty, type PropertyMatch } from "@/lib/ingestion/match";
import type { CanonicalLead } from "@/lib/ingestion/types";

// The pure matching rules live in match.ts (DB-free, unit-tested). This module
// only loads candidates from the database and delegates.
export {
  matchProperty,
  normalizeDomain,
  type MatchStrategy,
  type PropertyCandidate,
  type PropertyMatch,
} from "@/lib/ingestion/match";

/** Load all live properties as candidates and match the lead against them. */
export async function resolveProperty(
  lead: Pick<CanonicalLead, "leadSourceRaw" | "ghlFormId" | "pageUrl">,
): Promise<PropertyMatch | null> {
  const candidates = await db
    .select({
      id: properties.id,
      clientId: properties.clientId,
      ghlLeadSource: properties.ghlLeadSource,
      shortCode: properties.shortCode,
      ghlFormId: properties.ghlFormId,
      domain: properties.domain,
      billingType: properties.billingType,
      perLeadCallRate: properties.perLeadCallRate,
      perLeadFormRate: properties.perLeadFormRate,
      estimatedCallValue: properties.estimatedCallValue,
      estimatedFormValue: properties.estimatedFormValue,
      billableThresholdSeconds: properties.billableThresholdSeconds,
    })
    .from(properties)
    .where(isNull(properties.deletedAt));

  return matchProperty(candidates, lead);
}
