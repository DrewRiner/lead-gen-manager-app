"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { guideStepProgress } from "@/lib/db/schema";

// Per-user "Done" progress for the designed operator guides. Presence of a row
// = that step is checked. Persisted per app user (not per browser), so progress
// follows the operator across devices.

const schema = z.object({
  guideSlug: z.string().min(1).max(80),
  stepKey: z.string().min(1).max(80),
  done: z.boolean(),
});

export async function toggleGuideStep(input: {
  guideSlug: string;
  stepKey: string;
  done: boolean;
}): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { guideSlug, stepKey, done } = parsed.data;

  if (done) {
    await db
      .insert(guideStepProgress)
      .values({ profileId: user.id, guideSlug, stepKey })
      .onConflictDoNothing({
        target: [
          guideStepProgress.profileId,
          guideStepProgress.guideSlug,
          guideStepProgress.stepKey,
        ],
      });
  } else {
    await db
      .delete(guideStepProgress)
      .where(
        and(
          eq(guideStepProgress.profileId, user.id),
          eq(guideStepProgress.guideSlug, guideSlug),
          eq(guideStepProgress.stepKey, stepKey),
        ),
      );
  }
  return { ok: true };
}
