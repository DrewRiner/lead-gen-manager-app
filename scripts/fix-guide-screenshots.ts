/**
 * One-off, idempotent: turn leftover text "[SCREENSHOT: ...]" placeholder blocks
 * into empty image blocks (a clean upload slot in the editor, captioned with the
 * placeholder's description) — or delete the ones that are pure navigation where
 * the step reads fine without an image.
 *
 * Re-running is safe: once converted/removed there are no text placeholders left.
 *
 *   node --env-file=.env.local --import tsx scripts/fix-guide-screenshots.ts
 */
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { guideBlocks, guides } from "@/lib/db/schema";

// Descriptions to REMOVE (pure navigation; the text step is self-sufficient).
const REMOVE = new Set<string>([
  "Properties list with the property row",
  "Client page listing the properties they rent",
]);

async function main() {
  const rows = await db
    .select({
      id: guideBlocks.id,
      title: guides.title,
      content: guideBlocks.content,
    })
    .from(guideBlocks)
    .innerJoin(guides, eq(guides.id, guideBlocks.guideId))
    .where(and(isNull(guides.deletedAt), eq(guideBlocks.type, "text")));

  const perGuide = new Map<string, { converted: string[]; removed: string[] }>();

  for (const r of rows) {
    const md = (r.content as { markdown?: string } | null)?.markdown;
    if (!md) continue;
    const m = md.trim().match(/^\[SCREENSHOT:\s*(.*?)\]$/i);
    if (!m) continue; // only pure placeholder lines
    const desc = m[1].trim();

    const g = perGuide.get(r.title) ?? { converted: [], removed: [] };
    perGuide.set(r.title, g);

    if (REMOVE.has(desc)) {
      await db.delete(guideBlocks).where(eq(guideBlocks.id, r.id));
      g.removed.push(desc);
    } else {
      await db
        .update(guideBlocks)
        .set({
          type: "image",
          content: { url: "", caption: desc, alt: desc },
          updatedAt: new Date(),
        })
        .where(eq(guideBlocks.id, r.id));
      g.converted.push(desc);
    }
  }

  let totalConv = 0;
  let totalRem = 0;
  for (const [title, g] of [...perGuide].sort()) {
    if (g.converted.length === 0 && g.removed.length === 0) continue;
    console.log(`\n===== ${title} =====`);
    for (const d of g.converted) console.log(`  SLOT    ${d}`);
    for (const d of g.removed) console.log(`  REMOVED ${d}`);
    totalConv += g.converted.length;
    totalRem += g.removed.length;
  }
  console.log(`\nTotal: ${totalConv} converted to upload slots, ${totalRem} removed.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
