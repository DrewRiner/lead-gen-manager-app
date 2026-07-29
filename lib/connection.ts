// ---------------------------------------------------------------------------
// Dead-simple "can a lead route here right now?" signal. ONE question, forms
// only: is ghl_lead_source set? Calls (tracking_phone) are intentionally
// ignored — that channel isn't live yet. Derived; no schema change, no writes.
// ---------------------------------------------------------------------------

export interface ConnectionInput {
  ghlLeadSource: string | null;
}

/** Green when a Lead Source is set (a GHL form can route here), else red. */
export function isConnected(input: ConnectionInput): boolean {
  return (
    typeof input.ghlLeadSource === "string" &&
    input.ghlLeadSource.trim().length > 0
  );
}

export function connectionTooltip(connected: boolean): string {
  return connected
    ? "Connected — ready to collect leads."
    : "Not connected — add a Lead Source.";
}
