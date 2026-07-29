import {
  billableStatusEnum,
  billingTypeEnum,
  leadSourceEnum,
  leadTypeEnum,
  qualifiedByEnum,
} from "@/lib/db/schema";
import { toMoneyString } from "@/lib/money";
import { classifyFormQuality } from "@/lib/billing/form-quality";
import {
  scoreFormLead,
  type SpamDeps,
  type SpamResult,
  type SpamScoreInput,
} from "@/lib/spam/score-form-lead";

// ---------------------------------------------------------------------------
// THE single place that decides whether a lead is billable and what it is
// worth. Nothing else in the codebase may contain billing logic or a
// hardcoded duration threshold (CLAUDE.md rules 5 & 6). AI scoring will plug
// into this same function in a later phase.
// ---------------------------------------------------------------------------

export type BillableStatus = (typeof billableStatusEnum.enumValues)[number];
export type BillingType = (typeof billingTypeEnum.enumValues)[number];
export type LeadType = (typeof leadTypeEnum.enumValues)[number];
export type LeadSource = (typeof leadSourceEnum.enumValues)[number];
export type QualifiedBy = (typeof qualifiedByEnum.enumValues)[number];

/** Reasons the engine can attach to a decision. */
export const BILLABLE_REASON = {
  FORM_LEAD: "form_lead",
  DURATION_MET_THRESHOLD: "duration_met_threshold",
  DURATION_UNDER_THRESHOLD: "duration_under_threshold",
  MISSING_DURATION: "missing_duration",
} as const;

export interface EvaluateLeadInput {
  type: LeadType;
  callDurationSeconds: number | null;
}

export interface EvaluateLeadProperty {
  billingType: BillingType;
  perLeadCallRate: string;
  perLeadFormRate: string;
  estimatedCallValue: string;
  estimatedFormValue: string;
  billableThresholdSeconds: number;
}

export interface EvaluateLeadResult {
  billableStatus: BillableStatus;
  billableReason: string | null;
  qualifiedBy: QualifiedBy;
  /** Snapshotted onto leads.billed_amount. Money string, 2 decimals. */
  billedAmount: string;
  /** Snapshotted onto leads.estimated_value. Money string, 2 decimals. */
  estimatedValue: string;
  /** Present only for form leads that ran spam scoring, for logging/telemetry. */
  spam?: SpamResult;
}

/**
 * Optional spam-scoring context for a form lead. When provided, the form path
 * runs the (non-AI) spam scorer; a flagged lead becomes 'spam' (still saved,
 * zero billed/estimated). The async I/O (MX lookup, rate counts) lives behind
 * deps so this stays the one place the decision is made.
 */
export interface EvaluateLeadSpamContext {
  input: SpamScoreInput;
  deps: SpamDeps;
}

/** Per-lead rate applies only to per_lead and hybrid billing. */
function chargesPerLead(billingType: BillingType): boolean {
  return billingType === "per_lead" || billingType === "hybrid";
}

/**
 * Evaluate a single lead against its property's billing config.
 *
 * Phase 1 implements only the duration rule:
 * - Form leads are always billable.
 * - Call leads are billable when duration >= the property's threshold.
 * - Call leads under the threshold are not billable.
 * - Call leads with no duration go to pending_review.
 *
 * estimated_value is recorded on every billable lead regardless of billing
 * type — a flat_monthly property still books market value with $0 billed.
 */
export async function evaluateLead(
  lead: EvaluateLeadInput,
  property: EvaluateLeadProperty,
  spam?: EvaluateLeadSpamContext,
): Promise<EvaluateLeadResult> {
  // -- Form leads ----------------------------------------------------------
  if (lead.type === "form") {
    // Optional spam scoring. Flagged => 'spam', but still saved with zero value
    // so it stays reviewable (never a hard block). Conservative by design.
    if (spam) {
      const result = await scoreFormLead(spam.input, spam.deps);
      if (result.isSpam) {
        return {
          billableStatus: "spam",
          billableReason: spamReason(result),
          qualifiedBy: "spam_rule",
          billedAmount: "0.00",
          estimatedValue: "0.00",
          spam: result,
        };
      }
      // Not spam: fall through to the normal billable-form decision, but keep
      // the score for telemetry.
      return {
        billableStatus: "billable",
        billableReason: BILLABLE_REASON.FORM_LEAD,
        qualifiedBy: "duration_rule",
        billedAmount: chargesPerLead(property.billingType)
          ? toMoneyString(property.perLeadFormRate)
          : "0.00",
        estimatedValue: toMoneyString(property.estimatedFormValue),
        spam: result,
      };
    }
    return {
      billableStatus: "billable",
      billableReason: BILLABLE_REASON.FORM_LEAD,
      qualifiedBy: "duration_rule",
      billedAmount: chargesPerLead(property.billingType)
        ? toMoneyString(property.perLeadFormRate)
        : "0.00",
      estimatedValue: toMoneyString(property.estimatedFormValue),
    };
  }

  // -- Call leads ----------------------------------------------------------
  const duration = lead.callDurationSeconds;

  // Missing duration -> can't apply the rule yet.
  if (duration === null || duration === undefined) {
    return {
      billableStatus: "pending_review",
      billableReason: BILLABLE_REASON.MISSING_DURATION,
      qualifiedBy: "duration_rule",
      billedAmount: "0.00",
      estimatedValue: "0.00",
    };
  }

  // At or above threshold -> billable.
  if (duration >= property.billableThresholdSeconds) {
    return {
      billableStatus: "billable",
      billableReason: BILLABLE_REASON.DURATION_MET_THRESHOLD,
      qualifiedBy: "duration_rule",
      billedAmount: chargesPerLead(property.billingType)
        ? toMoneyString(property.perLeadCallRate)
        : "0.00",
      estimatedValue: toMoneyString(property.estimatedCallValue),
    };
  }

  // Under threshold -> not billable.
  return {
    billableStatus: "not_billable",
    billableReason: BILLABLE_REASON.DURATION_UNDER_THRESHOLD,
    qualifiedBy: "duration_rule",
    billedAmount: "0.00",
    estimatedValue: "0.00",
  };
}
