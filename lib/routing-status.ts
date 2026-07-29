// ---------------------------------------------------------------------------
// Pure routing-status classification for the Settings → Webhooks routing table.
// A property's ghl_lead_source is the value GHL forms must send. This decides,
// across ALL properties, whether each one is safely routable:
//   - "missing"   — no ghl_lead_source; can only route by form id / page url
//   - "duplicate" — another property shares the same value (case-insensitively,
//                   trimmed), so an inbound lead would match ambiguously
//   - "mapped"    — set and unique
//
// Duplicate detection is case-insensitive/trimmed to mirror how routing matches
// (lib/ingestion/match.ts) — that catches "Acme" vs "acme" collisions that the
// case-sensitive DB unique index does not.
// ---------------------------------------------------------------------------

export type RoutingStatus = "mapped" | "missing" | "duplicate";

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Classify one value given a precomputed map of normalized value -> count. */
export function routingStatusOf(
  value: string | null | undefined,
  counts: Map<string, number>,
): RoutingStatus {
  const k = norm(value);
  if (!k) return "missing";
  return (counts.get(k) ?? 0) > 1 ? "duplicate" : "mapped";
}

/** Classify every property's ghl_lead_source, returning id -> status. */
export function computeRoutingStatuses<
  T extends { id: string; ghlLeadSource: string | null },
>(rows: T[]): Map<string, RoutingStatus> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = norm(r.ghlLeadSource);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out = new Map<string, RoutingStatus>();
  for (const r of rows) out.set(r.id, routingStatusOf(r.ghlLeadSource, counts));
  return out;
}
