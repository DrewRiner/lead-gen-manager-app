/**
 * Seed the three "Integrations" setup guides (contact form, CallRail, Twilio).
 *
 * Idempotent on slug: re-running UPDATES each guide in place (title/summary/
 * category + blocks) and republishes. It never inserts duplicates and never
 * touches or retires any other guide — unlike seed-guides.ts, this script only
 * ever writes the three slugs listed here.
 *
 *   node --env-file=.env.local --import tsx scripts/seed-integration-guides.ts
 */
import { and, eq, isNull } from "drizzle-orm";

import { PLATFORM } from "@/lib/config";
import { db } from "@/lib/db";
import { guideBlocks, guides } from "@/lib/db/schema";
import type { GuideBlockType } from "@/lib/guides/types";

// The team only ever sees the white-labeled CRM brand (Engine Evolve). Our own
// product is referred to as "the dashboard" / "the app" in the copy below.
const P = PLATFORM.name; // "Engine Evolve"
const P_URL = PLATFORM.url; // "https://app.enginevolve.com"
const BASE = "https://lead-gen-manager-app.vercel.app";

type Block = { type: GuideBlockType; content: Record<string, unknown> };

const h = (text: string, level = 2): Block => ({ type: "heading", content: { text, level } });
const t = (markdown: string): Block => ({ type: "text", content: { markdown } });
/** An empty, captioned image slot — an editor drops the real screenshot in later. */
const img = (caption: string): Block => ({
  type: "image",
  content: { url: "", caption, alt: caption },
});
/** A warning callout. Rendered as its own bolded text block so it stands out. */
const warn = (markdown: string): Block => t(`**⚠️ Warning — ${markdown}**`);

interface GuideSeed {
  slug: string;
  title: string;
  category: string;
  summary: string;
  blocks: Block[];
}

const GUIDES: GuideSeed[] = [
  // ============================================================ GUIDE 1
  {
    slug: "connect-a-contact-form",
    title: "Connect a contact form (Engine Evolve)",
    category: "Integrations",
    summary:
      "Wire a property's web form so its submissions route to the right property instead of Unmatched.",
    blocks: [
      h("Why this matters"),
      t(
        "Contact forms are how web leads reach the dashboard. Everything hinges on one field: the form's **Source** must match the property's **Lead Source** in the dashboard character-for-character. Get it wrong and every submission lands in the **Unmatched** queue instead of on the property — the client is paying and hearing nothing.",
      ),
      h("Before you start"),
      t(
        `Have on hand:\n- The property's **exact name** as it appears in the dashboard's **Lead Source** setting (Settings → Webhooks routing table)\n- The **X-Webhook-Secret** value from the dashboard's **Settings → Webhooks**\n- Access to ${P} at ${P_URL}`,
      ),
      h("Steps"),
      t(`**1.** In ${P}, go to **Sites → Forms** and open (or create) this property's lead form.`),
      img(`${P} Sites → Forms with the property's form open`),
      t(
        "**2.** Add the required fields — **name, phone, email** — plus any qualifying fields you want the client to see (service needed, address, notes, etc.).",
      ),
      img("Form builder showing name, phone, and email fields"),
      t(
        "**3.** Set the form's **Source** field to **exactly** the property's name as it appears in the dashboard's **Lead Source** setting.",
      ),
      warn(
        "the Source must match the dashboard's Lead Source character-for-character (spacing, punctuation, capitalization). If it doesn't, the lead lands in Unmatched instead of routing to the property.",
      ),
      img("Form Source field set to the exact property name"),
      t(
        "**4.** Add a **hidden field** with the **Query Key** `website`, marked **Hidden**, with its value left **empty**. This is the spam honeypot — real visitors never see it and leave it blank, while bots fill it in and get auto-flagged as spam.",
      ),
      img("Hidden honeypot field, query key website, value empty"),
      t(
        `**5.** Build the delivery workflow: go to **Automation → Workflows**, add a trigger **Form Submitted** filtered to **this form**, then add a **Webhook** action (method **POST**) to:\n\n\`${BASE}/api/webhooks/ghl-form\`\n\nAdd a header **X-Webhook-Secret** set to the value from the dashboard's **Settings → Webhooks**.`,
      ),
      img("Workflow with Form Submitted trigger and a POST Webhook action"),
      warn(
        "the X-Webhook-Secret header value must match the dashboard's webhook secret exactly, or the submission is rejected before it ever reaches the property.",
      ),
      t(
        "**6.** Add the client **notification actions** (Send Email / Send SMS) as needed so the client is alerted on each new lead.",
      ),
      t("**7.** **Publish** the workflow so it goes live."),
      h("How to check it worked"),
      t(
        "Submit a **test entry** through the form. Within a few seconds it should appear on **that property's page** in the dashboard — not in the **Unmatched** queue. If it lands in Unmatched, re-check the form's Source against the property's Lead Source in the routing table.",
      ),
    ],
  },

  // ============================================================ GUIDE 2
  {
    slug: "connect-callrail-call-tracking",
    title: "Connect CallRail call tracking",
    category: "Integrations",
    summary:
      "Route a property's tracking-number calls into the dashboard automatically — with the exact gotchas we hit baked in.",
    blocks: [
      h("Why this matters"),
      t(
        "CallRail sends each tracked phone call to the dashboard so it routes to the right property automatically. The routing key is the **dialed tracking number**, so the dashboard's Tracking Phone has to match it exactly. The steps below encode the specific mistakes we've already made once — follow them in order so nobody repeats them.",
      ),
      h("Before you start"),
      t(
        "Have on hand:\n- The property's **CallRail tracking number**\n- The **CallRail webhook secret** from the dashboard's Settings → Webhooks\n- Access to the CallRail account for this property",
      ),
      h("Steps"),
      t(
        "**1.** In **CallRail → Numbers**, note the property's **tracking number**. In the dashboard, open that property and set its **Tracking Phone** to the same number.",
      ),
      img("CallRail Numbers list beside the dashboard Tracking Phone field"),
      warn(
        "the dialed tracking number is the routing key. If the dashboard's Tracking Phone doesn't match the CallRail number exactly, the call can't be matched to a property.",
      ),
      t("**2.** In the dashboard, open **Settings → Webhooks** and copy the **CallRail webhook secret** value."),
      img("Dashboard Settings → Webhooks showing the CallRail secret"),
      t(
        "**3.** In **CallRail → Settings → Integrations → Webhooks**, set the integration to **ACTIVE**.",
      ),
      warn("an Inactive integration silently sends nothing — no error, no calls, no leads. Confirm it reads Active."),
      t(
        `**4.** In **BOTH** the **Post-Call** and **Call Modified** boxes, paste this exact URL, with the secret as a query parameter:\n\n\`${BASE}/api/webhooks/callrail?secret=YOUR_SECRET\``,
      ),
      img("CallRail Post-Call and Call Modified boxes with the webhook URL"),
      warn(
        "CallRail on the standard plan does not send a signed header, so the secret rides in the URL. The `?secret=` value must match the dashboard's CALLRAIL_WEBHOOK_SECRET exactly. Fill BOTH boxes — miss one and you only get delayed leads.",
      ),
      warn(
        "Post-Call vs Call Modified: Post-Call fires at hangup (fast); Call Modified can lag up to ~20 minutes. Fill BOTH so leads arrive immediately instead of up to 20 minutes late.",
      ),
      t(
        "**5.** If the secret is stored as an **environment variable**, remember that changing it requires a **redeploy** to take effect. A common reason a “fixed” secret still rejects calls is that the new value hasn't been redeployed yet.",
      ),
      t("**6.** **Save** the CallRail webhook settings."),
      h("How to check it worked"),
      t(
        "Place a **test call of at least 20 seconds** to the tracking number. Wait a couple of minutes, then in the dashboard open **Settings → Webhooks** and confirm an event appears with **auth_valid true** — and that the call shows up on the **property's page**.",
      ),
      warn(
        "very short calls (under ~10 seconds) may not fire a webhook at all. Always test with a call of 20+ seconds.",
      ),
    ],
  },

  // ============================================================ GUIDE 3
  {
    slug: "connect-twilio-call-tracking",
    title: "Connect Twilio call tracking",
    category: "Integrations",
    summary:
      "Route calls for numbers running on Twilio (including WizCaller-managed numbers) into the dashboard.",
    blocks: [
      h("Why this matters"),
      t(
        "This serves the same purpose as CallRail, for numbers running on **Twilio** — including numbers managed through **WizCaller**, since those are Twilio numbers underneath. Once set up, Twilio calls route to the right property in the dashboard automatically, matched by the **dialed number**.",
      ),
      h("Before you start"),
      t(
        "Have on hand:\n- The property's **Twilio number**\n- Access to the **Twilio console** (and to WizCaller, if the number is managed there)\n- The Twilio **Auth Token** for the account (Twilio console → Account Dashboard)",
      ),
      h("Steps"),
      t(
        "**1.** Identify the **Twilio number** for the property, and set the dashboard's **Tracking Phone** for that property to match it exactly.",
      ),
      warn(
        "the dialed number is the routing key. The dashboard's Tracking Phone must match the Twilio number, or the call can't be matched to a property.",
      ),
      img("Twilio number beside the dashboard Tracking Phone field"),
      t(
        "**2.** In the dashboard, open **Settings → Webhooks** and copy the **Twilio endpoint URL**.",
      ),
      img("Dashboard Settings → Webhooks showing the Twilio endpoint URL"),
      t(
        `**3.** In the **Twilio console**, open the phone number's **configuration** page and set its **call status callback** (for **completed** calls, method **POST**) to:\n\n\`${BASE}/api/webhooks/twilio\``,
      ),
      img("Twilio console: status callback URL set for completed calls"),
      warn(
        "if the number is managed through **WizCaller**, add this callback in **WizCaller's Twilio config ALONGSIDE** its existing one — do not replace it — so WizCaller's own routing keeps working.",
      ),
      t(
        "**4.** Set the Twilio **Auth Token** in the dashboard environment (Vercel → Project → Settings → Environment Variables) as **`TWILIO_AUTH_TOKEN`**. The dashboard uses it to verify Twilio's **X-Twilio-Signature** on every inbound call — this is proper request signing, so there is no secret in the URL.",
      ),
      warn(
        "changing an environment variable on Vercel requires a **redeploy** to take effect — a common reason a freshly-set token still rejects calls.",
      ),
      t("**5.** **Save** the Twilio number's configuration."),
      h("How to check it worked"),
      t(
        "Place a **test call of at least 20 seconds** to the number. Within a minute, in the dashboard open **Settings → Webhooks** and confirm an event appears with **auth valid** — and that the call shows on the **property's page** with the red **Twilio** badge.",
      ),
      warn(
        "very short calls (under ~10 seconds) may not complete a status callback. Always test with a call of 20+ seconds.",
      ),
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

  console.log("\nDone. Open /guides to view them under Integrations.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
