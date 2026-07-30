import { toMoneyNumber } from "@/lib/money";

// ---------------------------------------------------------------------------
// Pure lead-value economics. Two figures per property-month, decided in ONE
// place so the list, the detail page, and the reports table stay consistent:
//
//   • Effective $/lead  — what the client is effectively paying per lead now.
//       flat_monthly / hybrid (rented): monthly_rate booked / billable leads.
//       per_lead:                       actual avg billed per billable lead.
//       unrented, or 0 billable leads:  null  → rendered "—".
//   • Market $/lead      — the niche rate card: the property's estimated call
//       and form values (what a lead is worth regardless of what's charged).
//
// Placed side by side these reveal underpriced flat deals: an effective rate
// well below market is a candidate to move to pay-per-lead.
// ---------------------------------------------------------------------------

/** Effective is "underpriced" when it's below this fraction of market value. */
export const UNDERPRICED_RATIO = 0.6;

/** Compact money label: "$50", "$12.50", "$1,200" (no trailing .00 when whole). */
function money(n: number): string {
  const whole = Number.isInteger(n);
  return (
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

export interface LeadEconomicsInput {
  billingType: string; // flat_monthly | per_lead | hybrid
  /** Any assignment (paid or trial) active during the month. */
  hasActiveAssignment: boolean;
  billableLeads: number;
  /** Flat rent booked for the month (flatRevenueForMonth); 0 for trials/per-lead. */
  flatBookedThisMonth: string | number;
  /** SUM(billed_amount) of the month's leads (per-lead charges). */
  perLeadBilledThisMonth: string | number;
  estimatedCallValue: string | number | null | undefined;
  estimatedFormValue: string | number | null | undefined;
  /** Month's call / form lead counts, to blend the market reference. */
  calls: number;
  forms: number;
}

export interface LeadEconomics {
  /** Effective $/lead as a number, or null when not applicable ("—"). */
  effectiveValue: number | null;
  /** Ready display, e.g. "$25/lead" or "—". */
  effectiveLabel: string;
  /** Market call value (numeric dollars). */
  marketCall: number;
  /** Market form value (numeric dollars). */
  marketForm: number;
  /** Ready display, e.g. "$50/call · $25/form", "$40/lead", or "—". */
  marketLabel: string;
  /** Blended market reference used for sorting and the underpriced cue. */
  marketBlended: number;
  /** True when effective is meaningfully below market — a reprice candidate. */
  underpriced: boolean;
}

/** Effective $/lead. null (→ "—") when unrented or there are no billable leads. */
export function effectiveCostPerLead(i: LeadEconomicsInput): number | null {
  if (!i.hasActiveAssignment) return null;
  if (i.billableLeads <= 0) return null;
  const numerator =
    i.billingType === "per_lead"
      ? toMoneyNumber(i.perLeadBilledThisMonth)
      : toMoneyNumber(i.flatBookedThisMonth); // flat_monthly | hybrid
  return numerator / i.billableLeads;
}

/** Blended market value per lead, weighted by the month's call/form mix. */
export function blendedMarket(
  call: number,
  form: number,
  calls: number,
  forms: number,
): number {
  if (calls + forms > 0 && (call > 0 || form > 0)) {
    return (call * calls + form * forms) / (calls + forms);
  }
  // No leads yet this month: fall back to the average of whichever rates exist.
  const present = [call, form].filter((v) => v > 0);
  if (present.length === 0) return 0;
  return present.reduce((s, v) => s + v, 0) / present.length;
}

function marketLabel(call: number, form: number): string {
  if (call <= 0 && form <= 0) return "—";
  if (call > 0 && form > 0) {
    return call === form
      ? `${money(call)}/lead`
      : `${money(call)}/call · ${money(form)}/form`;
  }
  return call > 0 ? `${money(call)}/call` : `${money(form)}/form`;
}

export function computeLeadEconomics(i: LeadEconomicsInput): LeadEconomics {
  const marketCall = toMoneyNumber(i.estimatedCallValue);
  const marketForm = toMoneyNumber(i.estimatedFormValue);
  const marketBlended = blendedMarket(marketCall, marketForm, i.calls, i.forms);

  const effectiveValue = effectiveCostPerLead(i);
  const underpriced =
    effectiveValue != null &&
    marketBlended > 0 &&
    effectiveValue < marketBlended * UNDERPRICED_RATIO;

  return {
    effectiveValue,
    effectiveLabel: effectiveValue == null ? "—" : `${money(effectiveValue)}/lead`,
    marketCall,
    marketForm,
    marketLabel: marketLabel(marketCall, marketForm),
    marketBlended,
    underpriced,
  };
}
