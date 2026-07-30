// ---------------------------------------------------------------------------
// "Is this property actually connected — can leads reach it?" This reports
// REALITY, not a config field. GREEN when EITHER a real ingested lead arrived
// recently OR an admin marked it ready; RED otherwise. The ghl_lead_source
// config value is deliberately NOT consulted here.
// ---------------------------------------------------------------------------

const WINDOW_DAYS = 30;

export interface ConnectionInput {
  /** Admin override: "marked ready to receive leads". */
  connectionReady: boolean;
  /** Most recent REAL ingested lead (ghl/callrail/twilio), or null. */
  lastRealLeadAt: Date | null;
}

export type ConnectionReason = "leads" | "manual" | "none";

export interface ConnectionStatus {
  connected: boolean;
  reason: ConnectionReason;
  /** Whole days since the last real lead, when reason === "leads". */
  daysAgo: number | null;
  tooltip: string;
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((a.getTime() - b.getTime()) / 86_400_000));
}

/**
 * Decide the connection status.
 * Priority: a real lead in the last 30 days (green, "leads") beats the manual
 * flag (green, "manual"); neither ⇒ red ("none"). Once real leads flow, the
 * lead condition keeps it green regardless of the flag.
 */
export function connectionStatus(
  input: ConnectionInput,
  now: Date = new Date(),
): ConnectionStatus {
  if (input.lastRealLeadAt) {
    const daysAgo = daysBetween(now, input.lastRealLeadAt);
    if (daysAgo <= WINDOW_DAYS) {
      const ago = daysAgo === 0 ? "today" : `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
      return {
        connected: true,
        reason: "leads",
        daysAgo,
        tooltip: `Receiving leads — last lead ${ago}.`,
      };
    }
  }
  if (input.connectionReady) {
    return {
      connected: true,
      reason: "manual",
      daysAgo: null,
      tooltip: "Marked ready. No leads received yet.",
    };
  }
  return {
    connected: false,
    reason: "none",
    daysAgo: null,
    tooltip: "Not connected — no leads received and not marked ready.",
  };
}
