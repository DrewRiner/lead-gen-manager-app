import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { guideBlocks, guides } from "@/lib/db/schema";
import type { GuideBlockContent, GuideBlockType } from "@/lib/guides/types";

export interface GuideListItem {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  summary: string | null;
  status: "draft" | "published";
  sortOrder: number;
  updatedAt: Date;
}

export interface GuideBlockData {
  id: string;
  type: GuideBlockType;
  content: GuideBlockContent;
  position: number;
}

export interface GuideWithBlocks extends GuideListItem {
  blocks: GuideBlockData[];
}

/** All non-deleted guides, ordered for the index (category, then sortOrder, title). */
export async function listGuides(): Promise<GuideListItem[]> {
  const rows = await db
    .select({
      id: guides.id,
      title: guides.title,
      slug: guides.slug,
      category: guides.category,
      summary: guides.summary,
      status: guides.status,
      sortOrder: guides.sortOrder,
      updatedAt: guides.updatedAt,
    })
    .from(guides)
    .where(isNull(guides.deletedAt))
    .orderBy(asc(guides.category), asc(guides.sortOrder), asc(guides.title));
  return rows;
}

/** One guide by slug with its ordered blocks, or null. */
export async function getGuideBySlug(
  slug: string,
): Promise<GuideWithBlocks | null> {
  const [guide] = await db
    .select({
      id: guides.id,
      title: guides.title,
      slug: guides.slug,
      category: guides.category,
      summary: guides.summary,
      status: guides.status,
      sortOrder: guides.sortOrder,
      updatedAt: guides.updatedAt,
    })
    .from(guides)
    .where(and(eq(guides.slug, slug), isNull(guides.deletedAt)))
    .limit(1);
  if (!guide) return null;

  const blocks = await db
    .select({
      id: guideBlocks.id,
      type: guideBlocks.type,
      content: guideBlocks.content,
      position: guideBlocks.position,
    })
    .from(guideBlocks)
    .where(eq(guideBlocks.guideId, guide.id))
    .orderBy(asc(guideBlocks.position));

  return {
    ...guide,
    blocks: blocks.map((b) => ({
      id: b.id,
      type: b.type as GuideBlockType,
      content: (b.content ?? {}) as GuideBlockContent,
      position: b.position,
    })),
  };
}
