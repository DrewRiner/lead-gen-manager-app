// ---------------------------------------------------------------------------
// "Pending enrichment" — a DISPLAY-ONLY derived state for CallRail call leads.
//
// CallRail's "Call Routing Complete" webhook fires ~7s after connect (before the
// call ends): it creates the lead with caller identity but duration 0 and no
// recording. ~20 min later "Call Modified" merges the real duration, recording,
// and transcript into the SAME lead via the (source_system, external_id) upsert.
// For that gap the lead is real but incomplete, so the UI softens the duration /
// recording / transcript cells and the (provisional) billing status instead of
// showing "0:00 / empty / not billable — too short," which is misleading.
//
// Detection is DERIVED (no column, no job). Deliberately does NOT use updated_at:
// every lead write (override, assign, the merge itself, even a retried delivery)
// bumps it, so it's an unreliable proxy. Instead:
//   • source_system = 'callrail' + type = 'call'  — only CallRail's two-delivery
//     pattern; forms never enrich.
//   • no real duration yet — 0 or null.
//   • recording_url is null — merges in on the second event.
//   • qualified_by <> 'manual' — a human override wins; never mask their decision.
//   • created_at within GRACE — recent enough that the merge is still pending.
//     Past the window an incomplete lead is treated as settled (a genuine
//     0-duration/abandoned call), not perpetually "in progress".
//
// Pairs with the ingestion fix that recomputes billing when the real duration
// merges in (see the enrichment merge). Once that lands, "pending" resolves to a
// corrected status, which is what makes softening the billing display honest.
// ---------------------------------------------------------------------------

/** How long after creation a CallRail lead may sit unenriched before it's
 *  treated as settled rather than pending. Covers CallRail's ~20-min merge. */
export const PENDING_ENRICHMENT_GRACE_MS = 30 * 60 * 1000;

export interface PendingEnrichmentInput {
  sourceSystem: string;
  type: string;
  callDurationSeconds: number | null;
  recordingUrl: string | null;
  qualifiedBy: string | null;
  createdAt: Date;
}

/** True while a CallRail call lead is still awaiting its enrichment merge. */
export function isPendingEnrichment(
  lead: PendingEnrichmentInput,
  now: Date = new Date(),
): boolean {
  return (
    lead.sourceSystem === "callrail" &&
    lead.type === "call" &&
    (lead.callDurationSeconds ?? 0) === 0 &&
    lead.recordingUrl == null &&
    lead.qualifiedBy !== "manual" &&
    now.getTime() - lead.createdAt.getTime() <= PENDING_ENRICHMENT_GRACE_MS
  );
}
