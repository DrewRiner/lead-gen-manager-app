/**
 * Seed the task-based how-to guides (Clients / Properties / Troubleshooting),
 * built from blocks.
 *
 * NON-DESTRUCTIVE on re-run: a guide that already exists (by slug, not
 * soft-deleted) is left completely untouched — its blocks and any uploaded
 * images are preserved. Only guides that don't exist yet are created. So this
 * is safe to re-run and will never reintroduce placeholders or drop real media.
 * Screenshots are added per-guide in the in-app editor, not here.
 *
 *   node --env-file=.env.local --import tsx scripts/seed-guides.ts
 */
import { and, eq, isNull } from "drizzle-orm";

import { PLATFORM } from "@/lib/config";
import { db } from "@/lib/db";
import { guideBlocks, guides } from "@/lib/db/schema";
import type { GuideBlockType } from "@/lib/guides/types";

// The team only ever sees the white-labeled platform brand (Engine Evolve) —
// never the underlying vendor's name.
const P = PLATFORM.name; // "Engine Evolve"
const P_URL = PLATFORM.url; // "https://app.enginevolve.com"

type Block = { type: GuideBlockType; content: Record<string, unknown> };

const h = (text: string, level = 2): Block => ({ type: "heading", content: { text, level } });
const t = (markdown: string): Block => ({ type: "text", content: { markdown } });

interface GuideSeed {
  slug: string;
  title: string;
  category: string;
  summary: string;
  blocks: Block[];
}

// Old feature-doc guides replaced by the task-based playbooks below. Re-running
// the seed soft-deletes these so they don't linger as duplicates.
const RETIRED_SLUGS = [
  "how-to-create-a-contact-form",
  "how-to-duplicate-an-automation",
  "how-to-edit-an-automation",
];

const GUIDES: GuideSeed[] = [
  // ===================== CATEGORY: Clients =====================
  {
    slug: "onboard-a-new-client-to-a-property",
    title: "Onboard a new client to a property",
    category: "Clients",
    summary: "A new client is renting a property — get them receiving its leads today.",
    blocks: [
      h("Why this matters"),
      t("A new client is now paying to rent this property and expects its leads to start arriving immediately. If onboarding is half-done — assigned in the dashboard but notifications never set — the client pays and hears nothing, and we look broken on day one. Finish every step before you call it done."),
      h("Before you start"),
      t("Have on hand:\n- The client's business name and contact name\n- Their **phone and email** for lead notifications\n- Which **property** they're renting\n- Access to the dashboard and to Engine Evolve"),
      h("Steps"),
      t("**1.** In the dashboard, open **Properties** and click the property this client is renting."),
      t("**2.** On the property page, click **Assign client**. Pick the client (or add them if they're new), set the rate/terms you were given, and save. The property should now show this client as the current client."),
      t(`**3.** Log in to ${P} at ${P_URL}. Open the sub-account / contact for this property and enter or confirm the client's **name, phone, and email** so they're correct before you route anything to them.`),
      t(`**4.** In ${P}, open **Automation → Workflows** and open this property's workflow. In each **Send Email** and **Send SMS** action, set the recipient to the client's email / phone from step 3.`),
      t("**5.** **Save and publish** the workflow so the new notifications take effect."),
      h("How to check it worked"),
      t(`In the dashboard, the property page shows this client as the **current client**. Then submit a test lead through the property's form (or use ${P}'s test action) and confirm the client receives the notification. If they do, onboarding is complete.`),
    ],
  },
  {
    slug: "update-a-clients-phone-or-email",
    title: "Update a client's phone number or email",
    category: "Clients",
    summary: "Change a client's contact info everywhere so they stop missing leads.",
    blocks: [
      h("Why this matters"),
      t("If a client's phone or email is out of date, their leads are being delivered to a dead number or an inbox nobody checks. The client is silently missing leads they're paying for — and when they notice, they blame us. The new info has to be updated in **every** place it's used, not just one."),
      h("Before you start"),
      t("Have on hand:\n- The client's **new** phone and/or email\n- Which **properties** this client rents (the client's page in the dashboard lists them)"),
      h("Steps"),
      t("**1.** In the dashboard, open **Clients**, find the client, and edit their record with the new phone/email. Save."),
      t("**2.** On the client's page, note **every property** they rent — you'll need to update each one's notifications."),
      t(`**3.** Log in to ${P} at ${P_URL} and update the client's **contact record** with the new phone/email.`),
      t(`**4.** For each of the client's properties, open its workflow in ${P} (**Automation → Workflows**) and replace the old email/number with the new one in **every** Send Email and Send SMS action. A property often has more than one — don't miss any.`),
      t("**5.** **Save and publish** each workflow you changed."),
      h("How to check it worked"),
      t("Send a test lead for one of the client's properties and confirm the notification reaches the **new** contact — and that nothing arrives at the old number/inbox. Repeat for each property if you want to be certain."),
    ],
  },
  {
    slug: "switch-a-property-to-a-new-client",
    title: "Switch a property to a new client",
    category: "Clients",
    summary: "Hand a property from an old client to a new one, cleanly and without missed leads.",
    blocks: [
      h("Why this matters"),
      t("The old client is done and a new one is taking over this property. Leads must **stop** going to the old client and **start** going to the new one, and the billing has to change hands cleanly. Get it half-right and either the old client keeps getting leads they no longer pay for, or the new client gets nothing."),
      h("Before you start"),
      t("Have on hand:\n- Which **property** is changing hands\n- The **new client's** name, phone, and email\n- The **date** the switch takes effect and the new rate/terms"),
      h("Steps"),
      t("**1.** In the dashboard, open the property. **End the old assignment** (Unassign / end assignment) effective the correct date so the old client stops as of then. Historical revenue is preserved."),
      t("**2.** **Assign the new client** on the same property, set their rate/terms, and save. The property should now show the new client as active."),
      t(`**3.** Log in to ${P} at ${P_URL}, open this property's workflow (**Automation → Workflows**), and change every **Send Email** / **Send SMS** action from the old client's email/phone to the **new client's**.`),
      t("**4.** Double-check the **old client is removed** from every notification action so they stop receiving this property's leads entirely."),
      t("**5.** **Save and publish** the workflow."),
      h("How to check it worked"),
      t("In the dashboard, the property shows the **new client active** and the old client's assignment **ended**. Submit a test lead and confirm the notification reaches the **new client only** — the old client should get nothing."),
    ],
  },

  // ===================== CATEGORY: Properties =====================
  {
    slug: "set-up-a-new-property-to-collect-leads",
    title: "Set up a new lead gen property to collect leads",
    category: "Properties",
    summary: "Wire a newly-ranked site so its leads flow into the dashboard, attributed correctly.",
    blocks: [
      h("Why this matters"),
      t("A new site is ranked and ready, but until it's wired up its leads go nowhere — or land in the dashboard unattributed. Getting the hidden fields right is what makes every lead route to the correct property automatically. The honeypot field is also what keeps bot spam out."),
      h("Before you start"),
      t("Have on hand:\n- The property's **exact name** as shown in the dashboard routing table\n- Access to Engine Evolve\n- The property's website to embed the form on"),
      h("Steps"),
      t("**1.** In the dashboard, open **Settings → Webhooks → Routing table**, find this property, and **copy** its exact Lead Source value with the copy button."),
      t(`**2.** Log in to ${P} at ${P_URL} and open **Sites → Forms → Builder → + Add Form**. Add the visible fields a visitor fills in: **first name, last name, email, phone, and a message** field.`),
      t("**3.** Add a **hidden field** with the **Query Key** `lead_source`, and set its **default value** to the exact name you copied in step 1. This is what routes the lead to this property."),
      t("**4.** Add one more **hidden field** with the **Query Key** `website`, and leave its default value **empty**. This is the honeypot — a real person never fills it, so anything that arrives with it filled is auto-flagged as spam."),
      t("**5.** **Publish** the form and embed it on the property's website."),
      h("How to check it worked"),
      t("In the dashboard, the property should now show a **green connection dot** next to its name. Submit a test lead through the form and confirm it appears on **that property's page** in Leads within a few seconds. If it lands in the unmatched queue instead, re-check the Lead Source value against the routing table."),
    ],
  },
  {
    slug: "change-how-a-client-gets-notified",
    title: "Change how or where a client gets notified",
    category: "Properties",
    summary: "Switch a client between text/email or add another recipient for a property's leads.",
    blocks: [
      h("Why this matters"),
      t("A client wants their lead alerts a different way — text instead of email, or a second person added. Getting this right is what keeps them responding to leads fast. Set it up wrong and they either miss alerts or get double-notified and tune them out."),
      h("Before you start"),
      t("Have on hand:\n- Exactly what they want (which **method** — text or email — and **who** should receive alerts)\n- Which **property** this is for"),
      h("Steps"),
      t(`**1.** Log in to ${P} at ${P_URL}, open **Automation → Workflows**, and open this property's workflow.`),
      t("**2.** To change the **method**: enable/add a **Send SMS** action for text, or a **Send Email** action for email, and remove the action for the method they no longer want."),
      t("**3.** To **add a person**: add their email or phone number to the relevant notification action(s) alongside the existing recipient."),
      t("**4.** Confirm every contact detail is correct and current before saving — a typo here means a missed lead."),
      t("**5.** **Save and publish** the workflow."),
      h("How to check it worked"),
      t("Send a test lead for this property and confirm the notification arrives by the **right method** and reaches **everyone who should get it** — and no one who shouldn't."),
    ],
  },

  // ===================== CATEGORY: Troubleshooting =====================
  {
    slug: "client-not-getting-leads-what-to-check",
    title: "A client says they're not getting leads — what to check",
    category: "Troubleshooting",
    summary: "Work through the likely causes in order when a client reports no leads.",
    blocks: [
      h("Why this matters"),
      t("This is urgent. A paying client who thinks they're getting nothing churns fast — often before they even tell us twice. Work through the causes below **in order**, from most common to least, so you find the real problem quickly instead of guessing."),
      h("Before you start"),
      t("Have on hand:\n- Which **client and property** they're asking about\n- Roughly **when** they last received a lead"),
      h("Steps"),
      t("**1. Is the property connected?** In the dashboard, open the property and check the **connection dot** next to its name. If it's **red**, no Lead Source is set and nothing can route — follow *Set up a new lead gen property to collect leads* to fix it."),
      t("**2. Are leads actually coming in?** On the property page, look at recent **Leads**. If leads are arriving in the dashboard but the client isn't hearing about them, it's a **notification** problem (steps 3–4). If **no** leads are arriving at all, it's an upstream **form/traffic** problem, not delivery."),
      t(`**3. Is the form still live?** In ${P} (${P_URL}), open the property's form and confirm it's still **Published** — not unpublished or reverted to draft. An unpublished form silently collects nothing.`),
      t(`**4. Are notifications pointing at the right person?** In ${P}, open the property's workflow and confirm the **Send Email / Send SMS** actions use the client's **current** email and phone — not an old one. If the info is stale, follow *Update a client's phone number or email*.`),
      t("**5. Are leads arriving but not routing?** In the dashboard, check the **unmatched leads** queue (Leads → filter **Unmatched**, or Settings → Webhooks → Recent unmatched leads). If the client's leads are landing there, the form's Lead Source value doesn't match — fix it per *Set up a new lead gen property to collect leads*."),
      h("How to check it worked"),
      t("Note which step turned out to be the problem, fix it, then submit a **test lead** and confirm it both **lands on the property** in the dashboard and **reaches the client's** notification. Then let the client know it's resolved."),
    ],
  },
];

async function main() {
  let created = 0;
  let skipped = 0;

  for (const g of GUIDES) {
    const [existing] = await db
      .select({ id: guides.id })
      .from(guides)
      .where(and(eq(guides.slug, g.slug), isNull(guides.deletedAt)))
      .limit(1);

    if (existing) {
      // NON-DESTRUCTIVE: the guide already exists — leave it and its blocks and
      // any uploaded images completely untouched. Content edits happen in the
      // in-app editor, which is the source of truth once a guide is live.
      skipped++;
      console.log(`Exists, left untouched: ${g.title} [${existing.id}]`);
      continue;
    }

    // Defensive: never seed an EMPTY image slot (there are none today, but this
    // keeps the invariant if image blocks are ever added to this seed).
    const blocks = g.blocks.filter(
      (b) => !(b.type === "image" && !((b.content.url as string | undefined) ?? "").trim()),
    );

    const guideId = await db.transaction(async (tx) => {
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
      await tx.insert(guideBlocks).values(
        blocks.map((b, i) => ({
          guideId: row.id,
          type: b.type,
          content: b.content,
          position: i,
        })),
      );
      return row.id;
    });

    created++;
    console.log(`Created: ${g.title} (${blocks.length} blocks) [${guideId}]`);
  }

  // Retire obsolete slugs from an earlier version of this seed. Idempotent: once
  // they're soft-deleted this matches 0 rows and is a no-op, and it never
  // touches any guide seeded above.
  for (const slug of RETIRED_SLUGS) {
    const res = await db
      .update(guides)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(guides.slug, slug), isNull(guides.deletedAt)))
      .returning({ id: guides.id });
    if (res.length > 0) console.log(`Retired old guide: ${slug}`);
  }

  console.log(`\nDone. ${created} created, ${skipped} left untouched. Open /guides.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
