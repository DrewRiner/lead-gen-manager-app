/**
 * Seed three real, published how-to guides, built from blocks. Idempotent on
 * slug — re-running replaces each guide's blocks and republishes. [SCREENSHOT:
 * ...] text blocks mark where to drop screenshots via the in-app editor.
 *
 *   node --env-file=.env.local --import tsx scripts/seed-guides.ts
 */
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { guideBlocks, guides } from "@/lib/db/schema";
import type { GuideBlockType } from "@/lib/guides/types";

type Block = { type: GuideBlockType; content: Record<string, unknown> };

const h = (text: string, level = 2): Block => ({ type: "heading", content: { text, level } });
const t = (markdown: string): Block => ({ type: "text", content: { markdown } });
const shot = (desc: string): Block => ({ type: "text", content: { markdown: `[SCREENSHOT: ${desc}]` } });

interface GuideSeed {
  slug: string;
  title: string;
  category: string;
  summary: string;
  blocks: Block[];
}

const GUIDES: GuideSeed[] = [
  {
    slug: "how-to-create-a-contact-form",
    title: "How to create a contact form",
    category: "Forms",
    summary: "Build a GHL form that routes leads to the right property, with the honeypot set.",
    blocks: [
      t("This walks through building a contact form in GoHighLevel that our app can match to the correct property. Do these steps in order — the two hidden fields at the end are what make routing and spam filtering work."),
      h("1. Create the form"),
      t("In GoHighLevel, open **Sites → Forms → Builder** and click **+ Add Form**. Give it a name that includes the property, e.g. \"Brunswick Roofing — Contact\"."),
      shot("GHL Forms list with the Add Form button"),
      h("2. Add the visible fields"),
      t("Add the fields a real visitor fills in:\n- First name\n- Last name\n- Email\n- Phone\n- A message / details textarea"),
      t("Keep it short — every extra field costs conversions. Name, phone, and email are enough to deliver a lead."),
      shot("Form canvas with name, email, phone, and message fields"),
      h("3. Add the hidden Lead Source field"),
      t("This is how the app knows which property a submission belongs to. Add a **hidden field**, set its **Query Key** to `lead_source` (or use a custom field mapped to it), and set its **default value** to the property's exact name as shown in the app's routing table."),
      t("Get the exact value from **Settings → Webhooks → Routing table** and copy it with the copy button. It must match exactly (case and spacing are ignored, but the words must match)."),
      shot("Hidden field settings with the Lead Source default value"),
      h("4. Add the honeypot field"),
      t("Bots fill in fields humans can't see. Add one more **hidden field** with the **Query Key** `website`. Leave its default value **empty**. A real person never touches it, so any submission that arrives with `website` filled in is flagged as spam automatically — while still being saved for you to review."),
      shot("Hidden honeypot field with query key set to website"),
      h("5. Connect the webhook"),
      t("Make sure the form's automation posts to our ingestion endpoint with the shared secret. If you're duplicating an existing property's setup, see **How to duplicate an automation**."),
      h("6. Publish and test"),
      t("Publish the form, embed it on the property's site, and submit one real test lead. It should appear in **Leads** within a few seconds, matched to the property. If it lands in the unmatched queue, re-check the Lead Source value against the routing table."),
      shot("Leads table showing the test submission matched to the property"),
    ],
  },
  {
    slug: "how-to-duplicate-an-automation",
    title: "How to duplicate an automation",
    category: "Automations",
    summary: "Clone a working workflow for a new property without breaking the webhook.",
    blocks: [
      t("When you launch a new property, the fastest way to wire up lead delivery is to clone a workflow that already works and change just the parts that are property-specific."),
      h("1. Find a working workflow"),
      t("In GoHighLevel, open **Automation → Workflows** and pick a property whose lead flow is already working end to end. This is your template."),
      shot("Workflows list with a known-good workflow highlighted"),
      h("2. Duplicate it"),
      t("Open the workflow's **⋯ menu** and choose **Clone / Duplicate**. Rename the copy for the new property immediately so you don't confuse the two, e.g. \"Newnan Fence — Lead Delivery\"."),
      shot("The clone option in the workflow menu"),
      h("3. Change the trigger's form"),
      t("Open the **trigger** step. It's pointing at the old property's form. Change it to the **new property's form** (the one you built in *How to create a contact form*). This is the most common thing people forget — if you skip it, the new workflow fires on the old property's leads."),
      shot("Trigger step with the form selector open"),
      h("4. Confirm the webhook action"),
      t("Open the **webhook / outbound POST** action and confirm:\n- The **URL** still points at our ingestion endpoint (copy it from **Settings → Webhooks** if unsure).\n- The **secret header** is still present and correct.\n- The body still forwards the form fields, including the hidden `lead_source` and `website` fields."),
      t("The webhook usually carries over unchanged from the clone — but confirm it, because a wrong URL or missing secret means leads silently never arrive."),
      shot("Webhook action showing the endpoint URL and secret header"),
      h("5. Publish and test"),
      t("Turn the workflow **Publish** toggle on, then submit a test lead through the new property's form. Confirm it lands in **Leads**, matched to the new property. Only then move on."),
    ],
  },
  {
    slug: "how-to-edit-an-automation",
    title: "How to edit an automation",
    category: "Automations",
    summary: "Update a workflow when client contact info or notification routing changes.",
    blocks: [
      t("Use this when a client's details change — new email, new phone, or a different person who should get notified. You're editing an existing workflow's notification actions, not rebuilding it."),
      h("1. Open the workflow"),
      t("In **Automation → Workflows**, open the workflow for the affected property. Each property has its own, named for it."),
      shot("Workflow editor opened for the property"),
      h("2. Update notification email actions"),
      t("Find the **Send Email** (or internal notification) actions. Update the **To** address to the client's new email. Check the **from name/subject** still reads correctly for this client, and fix any place their name or business is hard-coded in the body."),
      shot("Send Email action with the To field and body"),
      h("3. Update SMS / notification actions"),
      t("If there's a **Send SMS** action, update the destination number. Double-check the number is in the right format and belongs to the person who should actually receive lead alerts."),
      shot("Send SMS action with the phone number field"),
      h("4. Check who gets notified"),
      t("Confirm the full notification list is right:\n- The client contact(s) who should receive leads\n- Any internal teammate who should be copied\n- Remove anyone who has left or shouldn't be on it anymore"),
      h("5. Save and test"),
      t("**Save** the workflow. Send a test lead (or use GHL's test action) and confirm the new recipients get the notification and the old ones don't. Changes take effect on the next lead."),
      shot("Confirmation that the test notification reached the new recipient"),
    ],
  },
];

async function main() {
  for (const g of GUIDES) {
    const [existing] = await db
      .select({ id: guides.id })
      .from(guides)
      .where(and(eq(guides.slug, g.slug), isNull(guides.deletedAt)))
      .limit(1);

    const guideId = await db.transaction(async (tx) => {
      let id: string;
      if (existing) {
        id = existing.id;
        await tx
          .update(guides)
          .set({
            title: g.title,
            category: g.category,
            summary: g.summary,
            status: "published",
            updatedAt: new Date(),
          })
          .where(eq(guides.id, id));
        await tx.delete(guideBlocks).where(eq(guideBlocks.guideId, id));
      } else {
        const [row] = await tx
          .insert(guides)
          .values({
            title: g.title,
            slug: g.slug,
            category: g.category,
            summary: g.summary,
            status: "published",
          })
          .returning({ id: guides.id });
        id = row.id;
      }
      await tx.insert(guideBlocks).values(
        g.blocks.map((b, i) => ({
          guideId: id,
          type: b.type,
          content: b.content,
          position: i,
        })),
      );
      return id;
    });

    console.log(`${existing ? "Updated" : "Created"}: ${g.title} (${g.blocks.length} blocks) [${guideId}]`);
  }
  console.log("\nDone. Open /guides to view them.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
