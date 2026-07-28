-- New property columns.
ALTER TABLE "properties" ADD COLUMN "launched_on" date;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "target_monthly_rent" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint

-- Replace the property_status enum, remapping existing rows:
--   available -> producing, active -> producing, rented -> rented, paused -> paused.
-- Drop the default first (it references the old type), swap the type with a
-- mapping cast, then restore a new default.
ALTER TABLE "properties" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."property_status" RENAME TO "property_status_old";--> statement-breakpoint
CREATE TYPE "public"."property_status" AS ENUM('building', 'optimizing', 'producing', 'rented', 'paused');--> statement-breakpoint
ALTER TABLE "public"."properties"
  ALTER COLUMN "status" TYPE "public"."property_status"
  USING (
    CASE "status"::text
      WHEN 'available' THEN 'producing'
      WHEN 'active' THEN 'producing'
      WHEN 'rented' THEN 'rented'
      WHEN 'paused' THEN 'paused'
      ELSE 'producing'
    END::"public"."property_status"
  );--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "status" SET DEFAULT 'building';--> statement-breakpoint
DROP TYPE "public"."property_status_old";
