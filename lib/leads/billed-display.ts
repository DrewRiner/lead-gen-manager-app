import { formatCurrency } from "@/lib/money";
import type { LeadListRow } from "@/lib/queries/leads";

// How the "Billed" figure should READ in the UI. A flat-monthly client is not
// billed per lead, so "$0.00" is misleading — we say what's actually true
// instead. CSV export keeps the raw numeric billed_amount; this is display only.
//
// Derived from the property's CURRENT rental state (active assignment), not the
// lead's historical snapshot — matching how the rest of the app shows "now".

export interface BilledDisplay {
  text: string;
  /** Optional hover explanation (e.g. for "Flat rate"). */
  tooltip?: string;
  /** Render muted — the value isn't a real per-lead dollar charge. */
  muted: boolean;
}

export function billedDisplay(
  row: Pick<
    LeadListRow,
    | "billableStatus"
    | "billedAmount"
    | "propertyId"
    | "propertyBillingType"
    | "propertyStatus"
    | "propertyCurrentClientId"
  >,
): BilledDisplay {
  // Nothing is billed unless the lead qualified.
  if (row.billableStatus !== "billable") return { text: "—", muted: true };

  // No active assignment on the property → no client is being billed.
  if (row.propertyId == null || row.propertyCurrentClientId == null) {
    return { text: "Unrented", muted: true };
  }

  // Trials are free by definition.
  if (row.propertyStatus === "trial") return { text: "Trial", muted: true };

  // Flat-monthly clients don't pay per lead.
  if (row.propertyBillingType === "flat_monthly") {
    return {
      text: "Flat rate",
      tooltip: "This client pays a flat monthly rate, not per lead",
      muted: true,
    };
  }

  // per_lead | hybrid → the real snapshotted charge.
  return { text: formatCurrency(row.billedAmount), muted: false };
}
