import type { CanonicalLead } from "@/lib/ingestion/types";

// ---------------------------------------------------------------------------
// PURE property-matching logic (no database). Kept separate from resolve.ts so
// every matching rule is unit-testable without a DB connection.
// ---------------------------------------------------------------------------

/** How a lead was matched to a property (for logging / debugging). */
export type MatchStrategy =
  | "lead_source"
  | "short_code"
  | "ghl_form_id"
  | "page_url";

/** The subset of a property needed to both match and bill an ingested lead. */
export interface PropertyCandidate {
  id: string;
  clientId: string | null;
  ghlLeadSource: string | null;
  shortCode: string | null;
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

// Hosts that GHL-hosted forms always report (api.leadconnectorhq.com and the
// like). They identify the provider, never the property, so a page-url host
// under any of these domains is worthless for matching and must be ignored.
const IGNORED_HOST_SUFFIXES = ["leadconnectorhq.com", "gohighlevel.com"];

function isIgnoredHost(host: string): boolean {
  return IGNORED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith("." + suffix),
  );
}

/**
 * Pure matcher. Tries, in order:
 *   1. lead_source  vs property.ghl_lead_source (case-insensitive, trimmed)
 *   2. lead_source  vs property.short_code (case-insensitive, trimmed) — the
 *      same incoming Lead Source value, so forms can migrate to a stable code
 *      without breaking anything
 *   3. ghl_form_id  vs property.ghl_form_id (case-insensitive, trimmed) — the
 *      lead's ghlFormId comes from attributionSource.mediumId
 *   4. page_url host vs property.domain (both normalized) — treated as
 *      unreliable: GHL-hosted forms always report a leadconnectorhq.com /
 *      gohighlevel.com host, which is explicitly ignored here.
 * Returns the first match, or null when nothing matches.
 */
export function matchProperty(
  candidates: PropertyCandidate[],
  lead: Pick<CanonicalLead, "leadSourceRaw" | "ghlFormId" | "pageUrl">,
): PropertyMatch | null {
  // 1. Lead Source vs ghl_lead_source.
  const sourceKey = key(lead.leadSourceRaw);
  if (sourceKey) {
    const hit = candidates.find((c) => key(c.ghlLeadSource) === sourceKey);
    if (hit) return { property: hit, strategy: "lead_source" };
  }

  // 2. Lead Source vs short_code (same incoming value, stable-code fallback).
  if (sourceKey) {
    const hit = candidates.find((c) => key(c.shortCode) === sourceKey);
    if (hit) return { property: hit, strategy: "short_code" };
  }

  // 3. GHL form id.
  const formKey = key(lead.ghlFormId);
  if (formKey) {
    const hit = candidates.find((c) => key(c.ghlFormId) === formKey);
    if (hit) return { property: hit, strategy: "ghl_form_id" };
  }

  // 4. Page URL host vs property domain. GHL-hosted form hosts are ignored —
  // they identify the provider, not the property.
  const host = normalizeDomain(lead.pageUrl);
  if (host && !isIgnoredHost(host)) {
    const hit = candidates.find((c) => normalizeDomain(c.domain) === host);
    if (hit) return { property: hit, strategy: "page_url" };
  }

  return null;
}
