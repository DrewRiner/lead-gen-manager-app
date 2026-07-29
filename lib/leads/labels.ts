import { PLATFORM } from "@/lib/config";
import { titleCase } from "@/lib/format";

// Plain-language translations for the raw enum/string values stored on a lead,
// so the detail view reads like a CRM record, not a database dump.

const REASON_MAP: Record<string, string> = {
  valid_contact: "Valid contact info",
  form_lead: "Valid contact info", // legacy value, pre-backfill
  no_contact_info: "No phone or email",
  low_quality: "Looks like a test submission",
  spam_detected: "Flagged as spam",
  duration_met_threshold: "Call was long enough",
  duration_under_threshold: "Call was too short",
  missing_duration: "Call needs review — no duration",
  unmatched_no_property: "Not matched to a property",
};

/** billable_reason -> human sentence. Unknown/free-text reasons pass through. */
export function billableReasonLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  const r = raw.trim();
  // Keys may have an appended note in parens, so match on prefix too.
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
