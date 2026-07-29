import type { LeadSource, LeadType } from "@/lib/billing/evaluate-lead";

// ---------------------------------------------------------------------------
// The provider-neutral shape every adapter produces. The rest of the ingestion
// pipeline (resolve -> evaluate -> persist) only ever sees a CanonicalLead, so
// adding CallRail or Twilio later means writing one adapter that outputs this
// shape — nothing downstream changes.
// ---------------------------------------------------------------------------

export interface CanonicalLead {
  /** Integration that produced this, e.g. "ghl". Stored as leads.source_system. */
  provider: string;
  /** Stable per-provider id used to de-dupe. Never empty (adapters synthesize one). */
  externalId: string;
  type: LeadType;
  source: LeadSource;

  // -- Resolution hints (any one may match a property) --------------------
  /** The raw Lead Source value exactly as it arrived on the form. */
  leadSourceRaw: string | null;
  ghlFormId: string | null;
  pageUrl: string | null;

  // -- Contact / content --------------------------------------------------
  fullName: string | null;
  /** E.164 when parseable, otherwise the raw string, otherwise null. */
  phone: string | null;
  email: string | null;
  /** Human-readable "Label: value" lines composed from formAnswers. */
  message: string | null;
  formName: string | null;
  ghlContactId: string | null;
  ghlLocationId: string | null;
  /** Submitter IP (attributionSource.ip); persisted for spam rate signals. */
  ip: string | null;
  /**
   * Custom form fields keyed by their form label, e.g.
   * { "Property Type": "Residential" }. Empty-valued fields are dropped. Null
   * when the payload carried no custom fields.
   */
  formAnswers: Record<string, string> | null;

  // -- Timing -------------------------------------------------------------
  /** When the lead actually occurred (from the payload, not server time). */
  occurredAt: Date;
  /**
   * True when occurredAt fell back to ingestion time instead of the payload's
   * timestamp — either because none was present or because it was stale.
   * Surfaced in billable_reason so it's never silent.
   */
  occurredAtFallback: boolean;
  /**
   * When occurredAtFallback is true, the specific reason (e.g. "provider
   * timestamp was stale"). Composed into billable_reason. Null otherwise.
   */
  occurredAtNote: string | null;

  /** The untouched provider payload, stored verbatim on the lead + event. */
  rawPayload: unknown;
}

export type LeadTypeValue = LeadType;
