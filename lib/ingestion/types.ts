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
  message: string | null;
  formName: string | null;
  ghlContactId: string | null;
  ghlLocationId: string | null;

  // -- Timing -------------------------------------------------------------
  /** When the lead actually occurred (from the payload, not server time). */
  occurredAt: Date;
  /**
   * True when the payload carried no usable timestamp and occurredAt fell back
   * to ingestion time. Surfaced in billable_reason so it's never silent.
   */
  occurredAtFallback: boolean;

  /** The untouched provider payload, stored verbatim on the lead + event. */
  rawPayload: unknown;
}

export type LeadTypeValue = LeadType;
