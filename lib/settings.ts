import { db } from "@/lib/db";
import { appSettings, type AppSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const DEFAULTS = {
  orgTimezone: "America/New_York",
  defaultBillableThresholdSeconds: 60,
} as const;

/**
 * The single org-wide settings row. The 0001 migration bootstraps id=1, so
 * this normally hits a row; DEFAULTS are a safety net only.
 */
export async function getAppSettings(): Promise<
  Pick<AppSettings, "orgTimezone" | "defaultBillableThresholdSeconds"> & {
    id: number;
    updatedAt: Date | null;
  }
> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, 1))
    .limit(1);

  if (!row) {
    return { id: 1, updatedAt: null, ...DEFAULTS };
  }
  return row;
}

/** Convenience: just the org timezone string. */
export async function getOrgTimezone(): Promise<string> {
  const { orgTimezone } = await getAppSettings();
  return orgTimezone;
}
