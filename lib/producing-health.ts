// ---------------------------------------------------------------------------
// Derived "producing health" — a signal computed from actual billable lead flow,
// entirely separate from the manually-set properties.status. It NEVER mutates
// status; it only classifies and flags mismatches (see lib/queries/pipeline.ts
// and the reports/dashboard/property views).
//
// This is a PURE function (no DB, no clock) so the rules are unit-tested in
// isolation. The caller supplies the billable counts and the thresholds.
//
// Billable-only by construction: every count passed in is a count of leads with
// billable_status = 'billable'. Spam, non-billable, pending_review, disputed,
// and unmatched are excluded upstream and can never contribute here.
// ---------------------------------------------------------------------------

/** Momentum of the 3-month billable trend. */
export type Momentum = "rising" | "steady" | "falling" | "none";

/** How the derived signal relates to the manually-set status. */
export type HealthSignal =
  | "match" // producing/rented/trial and the data agrees — green
  | "overstated" // marked producing but the data doesn't meet the bar — amber
  | "understated" // building/optimizing but the data DOES meet the bar — blue
  | "neutral"; // nothing to flag

export interface ProducingHealthInput {
  /** The manually-set property status. */
  status: string;
  /** Billable leads in the trailing 30 days. */
  billable30d: number;
  /**
   * Billable leads per month for the last 3 COMPLETE calendar months, oldest
   * first: [m-3, m-2, m-1]. The current partial month is intentionally excluded
   * — trailing-30d already covers current recency, and a partial month would
   * make the signal flip mid-month.
   */
  monthlyBillable: number[];
  /** producing_min_billable_leads — the per-window bar. */
  minBillableLeads: number;
  /** producing_months_required — how many of the 3 months must clear the bar. */
  monthsRequired: number;
}

export interface ProducingHealth {
  /** True when both the 30-day bar and the 2-of-3-months rule are met. */
  derivedProducing: boolean;
  /** Number of the supplied months that individually cleared the bar. */
  qualifyingMonths: number;
  momentum: Momentum;
  signal: HealthSignal;
  /** Human-readable explanation for a mismatch signal; null when none. */
  reason: string | null;
}

// Statuses that assert the property is actively producing/delivering leads.
const PRODUCING_LIKE = new Set(["producing", "rented", "trial"]);
// Pre-launch statuses that do NOT yet claim to be producing.
const PRE_LAUNCH = new Set(["building", "optimizing"]);

// Momentum sensitivity: the most recent month is "rising"/"falling" when it is
// at least this far above / below the average of the two prior months.
const RISE_FACTOR = 1.25;
const FALL_FACTOR = 0.75;

/**
 * Classify the 3-month billable trend. "none" when there isn't enough volume
 * for a trend to be meaningful (less than one qualifying month's worth of
 * billable leads across the whole window).
 */
export function classifyMomentum(
  monthlyBillable: number[],
  minBillableLeads: number,
): Momentum {
  if (monthlyBillable.length === 0) return "none";
  const total = monthlyBillable.reduce((s, n) => s + n, 0);
  // Not enough signal to call a trend at all.
  if (total < Math.max(1, minBillableLeads)) return "none";

  const recent = monthlyBillable[monthlyBillable.length - 1];
  const prior = monthlyBillable.slice(0, -1);
  const priorAvg =
    prior.length > 0 ? prior.reduce((s, n) => s + n, 0) / prior.length : 0;

  // Prior months were empty but the recent one has volume => clearly rising.
  if (priorAvg === 0) return recent > 0 ? "rising" : "none";

  const ratio = recent / priorAvg;
  if (ratio >= RISE_FACTOR) return "rising";
  if (ratio <= FALL_FACTOR) return "falling";
  return "steady";
}

/**
 * Compute the full producing-health signal for one property.
 */
export function evaluateProducingHealth(
  input: ProducingHealthInput,
): ProducingHealth {
  const {
    status,
    billable30d,
    monthlyBillable,
    minBillableLeads,
    monthsRequired,
  } = input;

  const qualifyingMonths = monthlyBillable.filter(
    (n) => n >= minBillableLeads,
  ).length;

  const meets30d = billable30d >= minBillableLeads;
  const meetsMonths = qualifyingMonths >= monthsRequired;
  const derivedProducing = meets30d && meetsMonths;

  const momentum = classifyMomentum(monthlyBillable, minBillableLeads);

  let signal: HealthSignal = "neutral";
  let reason: string | null = null;

  if (PRODUCING_LIKE.has(status) && derivedProducing) {
    signal = "match";
  } else if (status === "producing" && !derivedProducing) {
    // Overstated: manually marked producing, but the lead flow doesn't back it.
    signal = "overstated";
    reason = meets30d
      ? // Recent volume is fine, but it hasn't been sustained across months.
        `Marked producing on ${billable30d} billable in 30d, but only ${qualifyingMonths} of the last 3 months cleared the bar — not yet sustained.`
      : // The canonical case: too few billable leads recently.
        `Marked producing but only ${billable30d} billable lead${
          billable30d === 1 ? "" : "s"
        } in 30d.`;
  } else if (PRE_LAUNCH.has(status) && derivedProducing) {
    // Understated: still marked pre-launch but it clears the producing bar.
    signal = "understated";
    reason = `Meets the producing bar (${billable30d} billable in 30d, ${qualifyingMonths} of last 3 months) while still ${status} — likely ready to sell.`;
  }

  return { derivedProducing, qualifyingMonths, momentum, signal, reason };
}
