import { toMoneyNumber } from "@/lib/money";

// ---------------------------------------------------------------------------
// Potential per-lead revenue for a single lead — the per-lead "ceiling".
//
// Only billable leads count (non-billable, spam, pending_review, disputed => 0).
// For a billable lead:
//   - if it was charged per-lead at the time (per_lead / hybrid billing, which
//     is exactly when a non-zero per-lead amount was snapshotted onto
//     billed_amount), use that recorded billed_amount;
//   - otherwise (flat_monthly, so no per-lead charge) use the lead's
//     estimated_value snapshot (its market value).
//
// The SQL aggregates in lib/queries/lifetime.ts replicate this exact rule.
// ---------------------------------------------------------------------------

export interface PotentialLead {
  billableStatus: string;
  billedAmount: string | number;
  estimatedValue: string | number;
}

export function potentialPerLead(lead: PotentialLead): number {
  if (lead.billableStatus !== "billable") return 0;
  const billed = toMoneyNumber(lead.billedAmount);
  return billed > 0 ? billed : toMoneyNumber(lead.estimatedValue);
}
