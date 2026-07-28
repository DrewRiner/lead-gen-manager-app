import { timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Shared-secret verification for inbound webhooks. Constant-time so a caller
// can't learn the secret by timing responses.
// ---------------------------------------------------------------------------

/** Header carrying the shared secret on inbound webhook requests. */
export const WEBHOOK_SECRET_HEADER = "x-webhook-secret";

/** Header names whose values must never be stored/displayed in cleartext. */
const SENSITIVE_HEADERS = new Set([WEBHOOK_SECRET_HEADER, "authorization", "cookie"]);

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

/** Snapshot request headers to a plain object, redacting sensitive values. */
export function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? "[redacted]" : value;
  });
  return out;
}
