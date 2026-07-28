import type { CanonicalLead } from "@/lib/ingestion/types";

// ---------------------------------------------------------------------------
// PURE property-matching logic (no database). Kept separate from resolve.ts so
// every matching rule is unit-testable without a DB connection.
// ---------------------------------------------------------------------------

/** How a lead was matched to a property (for logging / debugging). */
export type MatchStrategy = "lead_source" | "ghl_form_id" | "page_url";

/** The subset of a property needed to both match and bill an ingested lead. */
export interface PropertyCandidate {
  id: string;
  clientId: string | null;
  ghlLeadSource: string | null;
  ghlFormId: string | null;
  domain: string | null;
  billingType: "flat_monthly" | "per_lead" | "hybrid";
  perLeadCallRate: string;
  perLeadFormRate: string;
  estimatedCallValue: string;
  estimatedFormValue: string;
  billableThresholdSeconds: number;
}

export interface PropertyMatch {
  property: PropertyCandidate;
  strategy: MatchStrategy;
}

/** Case-insensitive, whitespace-trimmed comparison key. Null/empty -> null. */
function key(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalize a URL or hostname to a bare, comparable host:
 *   "https://WWW.Example.com/contact/?x=1" -> "example.com"
 * Strips protocol, credentials, "www.", path/query/fragment, port, and case.
 * Returns null when there's nothing host-like to extract.
 */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (input == null) return null;
  let s = input.trim().toLowerCase();
  if (s.length === 0) return null;

  // Drop scheme.
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  // Drop everything from the first path/query/fragment separator.
  s = s.split(/[/?#]/)[0] ?? "";
  // Drop userinfo (user:pass@host).
  const at = s.lastIndexOf("@");
  if (at !== -1) s = s.slice(at + 1);
  // Drop port.
  s = s.split(":")[0] ?? "";
  // Drop a leading www.
  s = s.replace(/^www\./, "");
  // Trim stray leading/trailing dots.
  s = s.replace(/^\.+|\.+$/g, "");

  return s.length > 0 ? s : null;
}

/**
 * Pure matcher. Tries, in order:
 *   1. lead_source  vs property.ghl_lead_source (case-insensitive, trimmed)
 *   2. ghl_form_id  vs property.ghl_form_id (case-insensitive, trimmed)
 *   3. page_url host vs property.domain (both normalized)
 * Returns the first match, or null when nothing matches.
 */
export function matchProperty(
  candidates: PropertyCandidate[],
  lead: Pick<CanonicalLead, "leadSourceRaw" | "ghlFormId" | "pageUrl">,
): PropertyMatch | null {
  // 1. Lead Source.
  const sourceKey = key(lead.leadSourceRaw);
  if (sourceKey) {
    const hit = candidates.find((c) => key(c.ghlLeadSource) === sourceKey);
    if (hit) return { property: hit, strategy: "lead_source" };
  }

  // 2. GHL form id.
  const formKey = key(lead.ghlFormId);
  if (formKey) {
    const hit = candidates.find((c) => key(c.ghlFormId) === formKey);
    if (hit) return { property: hit, strategy: "ghl_form_id" };
  }

  // 3. Page URL host vs property domain.
  const host = normalizeDomain(lead.pageUrl);
  if (host) {
    const hit = candidates.find((c) => normalizeDomain(c.domain) === host);
    if (hit) return { property: hit, strategy: "page_url" };
  }

  return null;
}
