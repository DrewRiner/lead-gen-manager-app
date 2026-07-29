import { createHmac, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Shared-secret verification for inbound webhooks. Constant-time so a caller
// can't learn the secret by timing responses.
// ---------------------------------------------------------------------------

/** Header carrying the shared secret on inbound webhook requests (GHL). */
export const WEBHOOK_SECRET_HEADER = "x-webhook-secret";

/** Header carrying CallRail's HMAC signature over the raw body. */
export const CALLRAIL_SIGNATURE_HEADER = "x-callrail-signature";

/** Header carrying Twilio's HMAC-SHA1 request signature. */
export const TWILIO_SIGNATURE_HEADER = "x-twilio-signature";

/** Header names whose values must never be stored/displayed in cleartext. */
const SENSITIVE_HEADERS = new Set([
  WEBHOOK_SECRET_HEADER,
  CALLRAIL_SIGNATURE_HEADER,
  TWILIO_SIGNATURE_HEADER,
  "authorization",
  "cookie",
]);

/**
 * Constant-time string comparison. Returns false when either value is missing
 * or lengths differ (length is not itself secret-revealing here).
 */
export function secretMatches(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Verify CallRail's HMAC-SHA256 signature over the RAW request body. NOTE: only
 * CallRail's higher tiers sign webhooks; our plan can't, so the CallRail
 * endpoint authenticates via a ?secret= URL query param instead (see the
 * route). This helper is kept for the signed-webhook path if we ever upgrade.
 * Accepts hex or base64 digests; constant-time; false on any missing input.
 */
export function callrailSignatureValid(
  rawBody: string,
  provided: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (!provided || !secret) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  return (
    secretMatches(provided.trim(), digest.toString("hex")) ||
    secretMatches(provided.trim(), digest.toString("base64"))
  );
}

/**
 * Verify Twilio's X-Twilio-Signature over a webhook request, per Twilio's
 * documented algorithm (proper request signing — NOT the CallRail ?secret= URL
 * shortcut):
 *   1. Start with the exact full request URL (protocol → end of query string)
 *      that Twilio was configured to call.
 *   2. For a POST, sort the POST params by name (case-sensitive Unix order) and
 *      append each name immediately followed by its value, with no delimiters.
 *   3. HMAC-SHA1 the resulting string, keyed with the account's auth token.
 *   4. Base64-encode the digest and constant-time compare to the header.
 *
 * @param url       The exact public URL Twilio posted to (incl. query string).
 * @param params    The POST params (form-decoded).
 * @param provided  The X-Twilio-Signature header value.
 * @param authToken TWILIO_AUTH_TOKEN. Missing token or signature => false.
 */
export function twilioSignatureValid(
  url: string,
  params: Record<string, string>,
  provided: string | null | undefined,
  authToken: string | null | undefined,
): boolean {
  if (!provided || !authToken) return false;
  let data = url;
  for (const name of Object.keys(params).sort()) {
    data += name + params[name];
  }
  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  return secretMatches(provided.trim(), expected);
}

/**
 * Whether inbound webhook signatures must be verified. ON by default; only a dev
 * override (WEBHOOK_SIGNATURE_VERIFICATION=false|0|off) disables it. Production
 * should never set the override.
 */
export function signatureVerificationEnabled(): boolean {
  const v = (process.env.WEBHOOK_SIGNATURE_VERIFICATION ?? "").trim().toLowerCase();
  return !(v === "false" || v === "0" || v === "off" || v === "no");
}

/** Snapshot request headers to a plain object, redacting sensitive values. */
export function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? "[redacted]" : value;
  });
  return out;
}
