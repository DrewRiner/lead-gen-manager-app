"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";

import { getProfile, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { guideBlocks, guides } from "@/lib/db/schema";

export type ActionResult =
  | { ok: true; message?: string; slug?: string }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Guides are authored in a block editor. A single save writes the guide meta
// and REPLACES its ordered blocks in one transaction — simple and predictable
// for the small guides this is built for. Deletes are soft.
// ---------------------------------------------------------------------------

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base.length > 0 ? base : "guide";
}

/** A slug unique among non-deleted guides, excluding `exceptId`. */
async function uniqueSlug(title: string, exceptId?: string): Promise<string> {
  const base = slugify(title);
  for (let n = 1; n < 200; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const clash = await db
      .select({ id: guides.id })
      .from(guides)
      .where(
        and(
          eq(guides.slug, candidate),
          isNull(guides.deletedAt),
          exceptId ? ne(guides.id, exceptId) : undefined,
        ),
      )
      .limit(1);
    if (clash.length === 0) return candidate;
  }
  // Extremely unlikely; fall back to a timestamp-free unique-ish suffix.
  return `${base}-${Math.floor(Math.random() * 1e6)}`;
}

const blockSchema = z.object({
  type: z.enum(["heading", "text", "image", "video", "embed"]),
  content: z.record(z.unknown()),
});

const guidePayloadSchema = z.object({
  title: z.string().trim().min(1, "A title is required.").max(200),
  category: z.string().trim().max(80).optional().nullable(),
  summary: z.string().trim().max(500).optional().nullable(),
  status: z.enum(["draft", "published"]),
  blocks: z.array(blockSchema).max(200),
});

export type GuidePayload = z.infer<typeof guidePayloadSchema>;

/** Write the ordered blocks for a guide, replacing any existing ones. */
async function writeBlocks(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  guideId: string,
  blocks: GuidePayload["blocks"],
) {
  await tx.delete(guideBlocks).where(eq(guideBlocks.guideId, guideId));
  if (blocks.length > 0) {
    await tx.insert(guideBlocks).values(
      blocks.map((b, i) => ({
        guideId,
        type: b.type,
        content: b.content,
        position: i,
      })),
    );
  }
}

export async function createGuide(payload: GuidePayload): Promise<ActionResult> {
  await requireUser();
  const profile = await getProfile();
  const parsed = guidePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  const slug = await uniqueSlug(data.title);

  await db.transaction(async (tx) => {
    const [guide] = await tx
      .insert(guides)
      .values({
        title: data.title,
        slug,
        category: data.category || null,
        summary: data.summary || null,
        status: data.status,
        createdBy: profile?.id ?? null,
      })
      .returning({ id: guides.id });
    await writeBlocks(tx, guide.id, data.blocks);
  });

  revalidatePath("/guides");
  return { ok: true, slug, message: "Guide created." };
}

export async function saveGuide(
  id: string,
  payload: GuidePayload,
): Promise<ActionResult> {
  await requireUser();
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid guide id." };
  }
  const parsed = guidePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const [existing] = await db
    .select({ id: guides.id, slug: guides.slug })
    .from(guides)
    .where(and(eq(guides.id, id), isNull(guides.deletedAt)))
    .limit(1);
  if (!existing) return { ok: false, error: "Guide not found." };

  await db.transaction(async (tx) => {
    await tx
      .update(guides)
      .set({
        title: data.title,
        category: data.category || null,
        summary: data.summary || null,
        status: data.status,
        updatedAt: new Date(),
      })
      .where(eq(guides.id, id));
    await writeBlocks(tx, id, data.blocks);
  });

  revalidatePath("/guides");
  revalidatePath(`/guides/${existing.slug}`);
  // Slug is stable across renames, so the URL never breaks.
  return { ok: true, slug: existing.slug, message: "Guide saved." };
}

export async function setGuideStatus(
  id: string,
  status: "draft" | "published",
): Promise<ActionResult> {
  await requireUser();
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid guide id." };
  }
  const [row] = await db
    .update(guides)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(guides.id, id), isNull(guides.deletedAt)))
    .returning({ slug: guides.slug });
  if (!row) return { ok: false, error: "Guide not found." };
  revalidatePath("/guides");
  revalidatePath(`/guides/${row.slug}`);
  return { ok: true, message: status === "published" ? "Published." : "Moved to draft." };
}

export async function deleteGuide(id: string): Promise<ActionResult> {
  await requireUser();
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid guide id." };
  }
  const [row] = await db
    .update(guides)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(guides.id, id), isNull(guides.deletedAt)))
    .returning({ slug: guides.slug });
  if (!row) return { ok: false, error: "Guide not found." };
  revalidatePath("/guides");
  return { ok: true, message: "Guide deleted." };
}
