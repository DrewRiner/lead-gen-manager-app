/**
 * READ-ONLY dry run: show what the fixed form qualification WOULD do to every
 * existing form lead, without writing anything. Confirms the "test test" lead
 * flips off billable and legit leads stay billable, before you apply migrations
 * and run the real backfill.
 *
 *   node --env-file=.env.local --import tsx scripts/verify-form-qual.ts
 */
import { and, eq, isNull } from "drizzle-orm";

import { evaluateLead } from "@/lib/billing/evaluate-lead";
import { db } from "@/lib/db";
import { leads, properties } from "@/lib/db/schema";

async function main() {
  const rows = await db
    .select({
      id: leads.id,
      callerName: leads.callerName,
      callerEmail: leads.callerEmail,
      callerPhone: leads.callerPhone,
      message: leads.message,
      formAnswers: leads.formAnswers,
      billableStatus: leads.billableStatus,
      qualifiedBy: leads.qualifiedBy,
      billableReason: leads.billableReason,
      billingType: properties.billingType,
      perLeadCallRate: properties.perLeadCallRate,
      perLeadFormRate: properties.perLeadFormRate,
      estimatedCallValue: properties.estimatedCallValue,
      estimatedFormValue: properties.estimatedFormValue,
      billableThresholdSeconds: properties.billableThresholdSeconds,
    })
    .from(leads)
    .innerJoin(properties, eq(properties.id, leads.propertyId))
    .where(and(isNull(leads.deletedAt), eq(leads.type, "form")));

  console.log(`\n${rows.length} matched form lead(s). Proposed re-qualification:\n`);

  for (const r of rows) {
    const decision = await evaluateLead(
      {
        type: "form",
        callDurationSeconds: null,
        form: {
          email: r.callerEmail,
          phone: r.callerPhone,
          name: r.callerName,
          message: r.message,
          hasFormAnswers: !!r.formAnswers,
        },
      },
      {
        billingType: r.billingType,
        perLeadCallRate: r.perLeadCallRate,
        perLeadFormRate: r.perLeadFormRate,
        estimatedCallValue: r.estimatedCallValue,
        estimatedFormValue: r.estimatedFormValue,
        billableThresholdSeconds: r.billableThresholdSeconds,
      },
    );
    const flip = decision.billableStatus !== r.billableStatus ? "  <== CHANGES" : "";
    console.log(`• ${r.callerName ?? r.callerEmail ?? r.id} (${r.callerEmail})`);
    console.log(
      `    now:      ${r.billableStatus} / ${r.qualifiedBy} / ${r.billableReason}`,
    );
    console.log(
      `    proposed: ${decision.billableStatus} / ${decision.qualifiedBy} / ${decision.billableReason}${flip}`,
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
