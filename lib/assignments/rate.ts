import { toMoneyNumber } from "@/lib/money";

export interface AssignmentRateInput {
  billingType: string;
  monthlyRate: string | null;
  perLeadCallRate: string | null;
  perLeadFormRate: string | null;
  isTrial: boolean;
}

/**
 * True when a PAID (non-trial) active assignment bills nothing — the rate that
 * applies for its billing type is zero, so a rented property records no
 * revenue. Trials are free by definition and never flagged. Display-only; this
 * makes no billing decision.
 */
export function isZeroRateAssignment(a: AssignmentRateInput | null | undefined): boolean {
  if (!a || a.isTrial) return false;
  const monthly = toMoneyNumber(a.monthlyRate);
  const call = toMoneyNumber(a.perLeadCallRate);
  const form = toMoneyNumber(a.perLeadFormRate);
  switch (a.billingType) {
    case "flat_monthly":
      return monthly === 0;
    case "per_lead":
      return call === 0 && form === 0;
    // hybrid / anything else: only flag when nothing at all is charged.
    default:
      return monthly === 0 && call === 0 && form === 0;
  }
}
