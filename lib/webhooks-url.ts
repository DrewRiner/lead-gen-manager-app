import { headers } from "next/headers";

// Server-only: build the exact production webhook URLs from the LIVE request
// host (same source Settings → Webhooks uses), never hardcoded. The CallRail
// URL embeds the real ?secret= (the value its route validates,
// CALLRAIL_WEBHOOK_SECRET) so operators copy a ready-to-paste URL — hand-
// assembling it caused a production outage. Internal route paths are unchanged.

export interface WebhookUrls {
  /** Engine Evolve (internal 'ghl') form endpoint. */
  ghl: string;
  /** CallRail endpoint, including ?secret= when the env var is set. */
  callrail: string;
  /** Twilio call-status-callback endpoint. */
  twilio: string;
  /** True when CALLRAIL_WEBHOOK_SECRET is configured (so the URL is complete). */
  callrailSecretConfigured: boolean;
}

export async function getWebhookUrls(): Promise<WebhookUrls> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;

  const secret = process.env.CALLRAIL_WEBHOOK_SECRET ?? "";
  const callrail = secret
    ? `${base}/api/webhooks/callrail?secret=${encodeURIComponent(secret)}`
    : `${base}/api/webhooks/callrail`;

  return {
    // The Engine Evolve (internal 'ghl') route is /api/webhooks/ghl-form in
    // production — NOT /api/webhooks/ghl. Using the real path avoids a 404.
    ghl: `${base}/api/webhooks/ghl-form`,
    callrail,
    twilio: `${base}/api/webhooks/twilio`,
    callrailSecretConfigured: secret.length > 0,
  };
}
