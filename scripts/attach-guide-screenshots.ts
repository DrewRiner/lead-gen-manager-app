/**
 * Upload specific screenshots to the guide-media bucket and set them on the
 * matching (guide slug + caption) image blocks. Only high-confidence matches.
 *
 *   node --env-file=.env.local --import tsx scripts/attach-guide-screenshots.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { guideBlocks, guides } from "@/lib/db/schema";

const IMG_DIR = join(process.cwd(), "guide-content", "images");
const BUCKET = "guide-media";

// High-confidence match: timestamp fragment (filenames use a narrow no-break
// space before AM/PM, so match on the unique time fragment) -> guide + caption.
const MAP: { frag: string; slug: string; caption: string }[] = [
  {
    frag: "12.28.00",
    slug: "set-up-a-new-property-to-collect-leads",
    caption: "Engine Evolve form builder with the visible fields",
  },
  {
    frag: "12.29.31",
    slug: "change-how-a-client-gets-notified",
    caption: "Property workflow open in Engine Evolve",
  },
  {
    frag: "12.29.59",
    slug: "change-how-a-client-gets-notified",
    caption: "Send SMS and Send Email actions in the workflow",
  },
];

const FILES = readdirSync(IMG_DIR);
function findFile(frag: string): string {
  const f = FILES.find((n) => n.includes(frag) && n.toLowerCase().endsWith(".png"));
  if (!f) throw new Error(`No screenshot matching "${frag}"`);
  return f;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const sb = createClient(url, key, { auth: { persistSession: false } });

  for (const m of MAP) {
    // Find the exact block (guide slug + caption).
    const rows = await db
      .select({ id: guideBlocks.id })
      .from(guideBlocks)
      .innerJoin(guides, eq(guides.id, guideBlocks.guideId))
      .where(
        and(
          isNull(guides.deletedAt),
          eq(guides.slug, m.slug),
          eq(guideBlocks.type, "image"),
          sql`${guideBlocks.content}->>'caption' = ${m.caption}`,
        ),
      );
    if (rows.length !== 1) {
      console.log(`SKIP (${rows.length} matches): ${m.slug} / "${m.caption}"`);
      continue;
    }

    const fileName = findFile(m.frag);
    const buf = readFileSync(join(IMG_DIR, fileName));
    const path = `images/${randomUUID()}.png`;
    const up = await sb.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: "image/png", upsert: true });
    if (up.error) {
      console.log(`UPLOAD FAILED ${fileName}: ${up.error.message}`);
      continue;
    }
    const publicUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    await db
      .update(guideBlocks)
      .set({
        content: { url: publicUrl, caption: m.caption, alt: m.caption },
        updatedAt: new Date(),
      })
      .where(eq(guideBlocks.id, rows[0].id));

    console.log(`ATTACHED ${m.slug} / "${m.caption}"`);
    console.log(`   ${publicUrl}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
