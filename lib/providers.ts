// Single source of truth for how a provider's INTERNAL value is shown to users.
//
// The internal values NEVER change — 'ghl' is stored in webhook_events.provider
// and leads.source_system (live rows exist), the adapter/route/types/env all key
// off it, and Engine Evolve posts to /api/webhooks/ghl in production. We only
// white-label the DISPLAY: GoHighLevel is shown as "Engine Evolve"; users must
// never see "GoHighLevel" or "GHL".
//
// Render every provider through providerLabel()/PROVIDER_LABELS. Never hardcode
// a provider's display name at a call site.

export const PROVIDER_LABELS = {
  ghl: "Engine Evolve",
  callrail: "CallRail",
  twilio: "Twilio",
} as const;

/** Internal provider keys that can host a property's tracking number / data. */
export type ProviderKey = keyof typeof PROVIDER_LABELS;

/**
 * Selectable providers for the property "Where is this number hosted?" field,
 * in the order shown. Values are the internal keys stored on the property.
 */
export const CALL_PROVIDER_OPTIONS: readonly ProviderKey[] = [
  "callrail",
  "twilio",
  "ghl",
] as const;

/** True when a string is a known provider key. */
export function isProviderKey(value: string | null | undefined): value is ProviderKey {
  return value != null && value in PROVIDER_LABELS;
}

/** Display name for a provider value. Unknown/empty → em dash (never leaks a raw key). */
export function providerLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return (PROVIDER_LABELS as Record<string, string>)[value] ?? value;
}
