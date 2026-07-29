/**
 * READ-ONLY: score the real leads currently in the database with the live spam
 * scorer (real MX lookup; rate counts stubbed to 0 since submitter_ip isn't
 * migrated yet and there's little data). No writes.
 *
 *   node --env-file=.env.local --import tsx scripts/verify-spam.ts
 */
import { desc, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { lookupMxCached } from "@/lib/spam/deps";
import { scoreFormLead, SPAM_CONFIG } from "@/lib/spam/score-form-lead";

async function main() {
  const rows = await db
    .select({
      id: leads.id,
      type: leads.type,
      callerName: leads.callerName,
      callerEmail: leads.callerEmail,
      callerPhone: leads.callerPhone,
      message: leads.message,
      billableStatus: leads.billableStatus,
      rawPayload: leads.rawPayload,
    })
    .from(leads)
    .where(isNull(leads.deletedAt))
    .orderBy(desc(leads.occurredAt))
    .limit(25);

  console.log(`\nScoring ${rows.length} lead(s) with threshold ${SPAM_CONFIG.defaultThreshold}\n`);

  for (const r of rows) {
    if (r.type !== "form") {
      console.log(`- ${r.callerName ?? r.callerEmail ?? r.id} [${r.type}] — not a form lead, skipped`);
      continue;
    }
    const raw = (r.rawPayload ?? {}) as Record<string, unknown>;
    const attribution = (raw.attributionSource ?? {}) as Record<string, unknown>;
    const ip = typeof attribution.ip === "string" ? attribution.ip : null;

    const result = await scoreFormLead(
      {
        email: r.callerEmail,
        phone: r.callerPhone,
        name: r.callerName,
        message: r.message,
        ip,
        rawFields: raw,
      },
      {
        lookupMx: (domain) => lookupMxCached(domain),
        rateCounts: async () => ({ sameContactCount: 0, distinctProperties: 0 }),
        threshold: SPAM_CONFIG.defaultThreshold,
      },
    );

    console.log(
      `- ${r.callerName ?? r.callerEmail ?? r.id} (${r.callerEmail}) [stored: ${r.billableStatus}]`,
    );
    console.log(
      `    score=${result.score}  isSpam=${result.isSpam}  signals=[${result.signals.join(", ") || "none"}]`,
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
