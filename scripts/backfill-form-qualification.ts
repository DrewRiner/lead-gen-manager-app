/**
 * One-off, idempotent backfill: re-run the form qualification rules on existing
 * FORM leads that were mis-qualified under the old shared duration logic
 * (qualified_by = 'duration_rule'). Corrects qualified_by / billable_status /
 * billable_reason / billed_amount / estimated_value.
 *
 * Skips manual overrides and spam (nothing to fix there). Does NOT re-run spam
 * scoring — it only applies the pure contact/quality rules via evaluateLead.
 *
 *   node --env-file=.env.local --import tsx scripts/backfill-form-qualification.ts
 */
import { and, eq, isNull } from "drizzle-orm";

import { evaluateLead } from "@/lib/billing/evaluate-lead";
import { db } from "@/lib/db";
import { leads, properties } from "@/lib/db/schema";

async function main() {
  // Every form lead still stamped with the old call-logic qualifier.
  const rows = await db
    .select({
      id: leads.id,
      callerName: leads.callerName,
      callerPhone: leads.callerPhone,
      callerEmail: leads.callerEmail,
      message: leads.message,
      formAnswers: leads.formAnswers,
      billableStatus: leads.billableStatus,
      billableReason: leads.billableReason,
      billedAmount: leads.billedAmount,
      estimatedValue: leads.estimatedValue,
      billingType: properties.billingType,
      perLeadCallRate: properties.perLeadCallRate,
      perLeadFormRate: properties.perLeadFormRate,
      estimatedCallValue: properties.estimatedCallValue,
      estimatedFormValue: properties.estimatedFormValue,
      billableThresholdSeconds: properties.billableThresholdSeconds,
    })
    .from(leads)
    .innerJoin(properties, eq(properties.id, leads.propertyId))
    .where(
      and(
        isNull(leads.deletedAt),
        eq(leads.type, "form"),
        eq(leads.qualifiedBy, "duration_rule"),
      ),
    );

  console.log(`Found ${rows.length} form lead(s) with qualified_by='duration_rule'.\n`);

  let changed = 0;
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

    const statusChanged = decision.billableStatus !== r.billableStatus;
    await db
      .update(leads)
      .set({
        billableStatus: decision.billableStatus,
        billableReason: decision.billableReason,
        qualifiedBy: decision.qualifiedBy,
        billedAmount: decision.billedAmount,
        estimatedValue: decision.estimatedValue,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, r.id));

    changed += 1;
    const label = r.callerName ?? r.callerEmail ?? r.id;
    console.log(
      `  ${statusChanged ? "FLIP" : "  · "} ${label}: ${r.billableStatus} -> ${decision.billableStatus} (${decision.billableReason}, ${decision.qualifiedBy})`,
    );
  }

  console.log(`\nRe-qualified ${changed} form lead(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
