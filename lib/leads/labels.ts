import { PLATFORM } from "@/lib/config";
import { titleCase } from "@/lib/format";

// Plain-language translations for the raw enum/string values stored on a lead,
// so the detail view reads like a CRM record, not a database dump.

// Static reasons that don't depend on the property threshold. Wording states
// the RULE, not a verdict, and stays short enough for a table cell.
const REASON_MAP: Record<string, string> = {
  valid_contact: "Valid contact info",
  form_lead: "Valid contact info", // legacy value, pre-backfill
  no_contact_info: "No contact info provided",
  low_quality: "Failed quality check",
  spam_detected: "Flagged as spam",
  unmatched_no_property: "Not matched to a property",
};

const DEFAULT_THRESHOLD = 60;

export interface ReasonLabelOptions {
  /** qualified_by = 'manual' always reads as an override, whatever the note. */
  qualifiedBy?: string | null;
  /** The property's billable_threshold_seconds, for the duration reasons. */
  thresholdSeconds?: number | null;
}

/** billable_reason -> human rule statement. Unknown/free-text reasons pass through. */
export function billableReasonLabel(
  raw: string | null | undefined,
  opts?: ReasonLabelOptions,
): string {
  const r = raw?.trim() ?? "";

  // A manual override wins over whatever automated reason was stored, but we
  // still surface the operator's recorded reason (the WHY) when there is one.
  if (opts?.qualifiedBy === "manual") {
    if (!r) return "Manually overridden";
    // Already self-describing (e.g. "Manually marked not spam") — show as-is.
    if (/^manual/i.test(r)) return r;
    return `Manually overridden — ${r}`;
  }

  if (!r) return "—";
  const t = opts?.thresholdSeconds ?? DEFAULT_THRESHOLD;

  // Duration reasons interpolate the property's actual threshold. Match on
  // prefix too, since ingestion may append a note (e.g. occurred_at fallback).
  if (r.startsWith("duration_met_threshold")) return `Exceeded ${t}s threshold`;
  if (r.startsWith("duration_under_threshold")) return `Under ${t}s threshold`;
  if (r.startsWith("missing_duration")) return "Duration pending";

  for (const [key, label] of Object.entries(REASON_MAP)) {
    if (r === key || r.startsWith(key)) return label;
  }
  if (/^spam:/i.test(r)) return "Flagged as spam";
  return r; // already human (manual override text, "Manually marked not spam", …)
}

const QUALIFIED_MAP: Record<string, string> = {
  form_validation: "Form validation",
  duration_rule: "Call duration",
  manual: "Manual override",
  spam_rule: "Spam filter",
  ai: "AI",
};

export function qualifiedByLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  return QUALIFIED_MAP[raw] ?? titleCase(raw);
}

const SOURCE_SYSTEM_MAP: Record<string, string> = {
  // The team only sees the white-labeled platform name, never the vendor's.
  ghl: `Contact form (${PLATFORM.name})`,
  callrail: "CallRail",
  twilio: "Twilio",
  manual: "Manual entry",
};

export function sourceSystemLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  return SOURCE_SYSTEM_MAP[raw] ?? titleCase(raw);
}

const SOURCE_MAP: Record<string, string> = {
  direct: "Direct",
  organic: "Organic",
  gbp: "GBP",
  other: "Other",
};

export function sourceLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  return SOURCE_MAP[raw] ?? titleCase(raw);
}
