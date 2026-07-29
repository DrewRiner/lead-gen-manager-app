import { resolveMx } from "node:dns/promises";

import { and, eq, gte, isNull, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import type { SpamDeps, SpamRateCounts } from "@/lib/spam/score-form-lead";

// ---------------------------------------------------------------------------
// Real (I/O-backed) implementations of the injectable spam deps. Kept OUT of
// score-form-lead.ts so the scorer stays pure and unit-testable without a
// network or a database — this file is imported only by the ingestion
// pipeline. Tests inject their own mock deps instead.
// ---------------------------------------------------------------------------

// Simple in-process MX cache. Domains rarely change their MX; a short TTL keeps
// a burst of spam from the same domain to a single DNS query.
const MX_TTL_MS = 60 * 60 * 1000; // 1 hour
const mxCache = new Map<string, { hasMx: boolean; at: number }>();

/** True when the domain has at least one MX record. Cached; fails safe to true. */
export async function lookupMxCached(
  domain: string,
  now: Date = new Date(),
): Promise<boolean> {
  const key = domain.toLowerCase();
  const cached = mxCache.get(key);
  if (cached && now.getTime() - cached.at < MX_TTL_MS) return cached.hasMx;

  let hasMx: boolean;
  try {
    const records = await resolveMx(key);
    hasMx = Array.isArray(records) && records.length > 0;
  } catch (err) {
    const code = (err as { code?: string }).code;
    // ENOTFOUND / ENODATA are authoritative "no mail" answers. Any other error
    // (timeout, SERVFAIL) is inconclusive — fail SAFE (assume mail works) so a
    // flaky resolver never flags a real lead.
    hasMx = code === "ENOTFOUND" || code === "ENODATA" ? false : true;
  }
  mxCache.set(key, { hasMx, at: now.getTime() });
  return hasMx;
}

/**
 * Prior-submission counts for the rate signals, over recent windows. Counts
 * only leads that already exist (the lead being scored isn't inserted yet), so
 * "3 prior in the last hour" means this is at least the 4th — deliberately
 * conservative.
 */
export async function countRecentSubmissions(
  contact: { email: string | null; phone: string | null; ip: string | null },
  now: Date = new Date(),
): Promise<SpamRateCounts> {
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const shortWindowAgo = new Date(now.getTime() - 15 * 60 * 1000);

  const email = contact.email?.trim() || null;
  const phone = contact.phone?.trim() || null;
  const ip = contact.ip?.trim() || null;

  // Same email OR phone in the last hour.
  const contactMatch =
    email || phone
      ? or(
          email ? eq(leads.callerEmail, email) : undefined,
          phone ? eq(leads.callerPhone, phone) : undefined,
        )
      : sql`false`;

  const [sameContact] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(isNull(leads.deletedAt), gte(leads.occurredAt, hourAgo), contactMatch));

  // Distinct properties this submitter (ip / email / phone) hit very recently.
  const submitterMatch =
    ip || email || phone
      ? or(
          ip ? eq(leads.submitterIp, ip) : undefined,
          email ? eq(leads.callerEmail, email) : undefined,
          phone ? eq(leads.callerPhone, phone) : undefined,
        )
      : sql`false`;

  const [distinct] = await db
    .select({ n: sql<number>`count(distinct ${leads.propertyId})::int` })
    .from(leads)
    .where(
      and(
        isNull(leads.deletedAt),
        gte(leads.occurredAt, shortWindowAgo),
        submitterMatch,
      ),
    );

  return {
    sameContactCount: sameContact?.n ?? 0,
    distinctProperties: distinct?.n ?? 0,
  };
}

/** Build the real SpamDeps for a given inbound lead + threshold. */
export function makeSpamDeps(
  contact: { email: string | null; phone: string | null; ip: string | null },
  threshold: number,
  now: Date = new Date(),
): SpamDeps {
  return {
    lookupMx: (domain) => lookupMxCached(domain, now),
    rateCounts: () => countRecentSubmissions(contact, now),
    threshold,
  };
}
