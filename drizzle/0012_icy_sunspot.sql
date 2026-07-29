CREATE TYPE "public"."guide_block_type" AS ENUM('heading', 'text', 'image', 'video', 'embed');--> statement-breakpoint
CREATE TYPE "public"."guide_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "guide_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guide_id" uuid NOT NULL,
	"type" "guide_block_type" NOT NULL,
	"content" jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"category" text,
	"summary" text,
	"status" "guide_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "guide_blocks" ADD CONSTRAINT "guide_blocks_guide_id_guides_id_fk" FOREIGN KEY ("guide_id") REFERENCES "public"."guides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guides" ADD CONSTRAINT "guides_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guide_blocks_guide_id_position_idx" ON "guide_blocks" USING btree ("guide_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "guides_slug_uniq" ON "guides" USING btree ("slug") WHERE "guides"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "guides_status_idx" ON "guides" USING btree ("status");
-- ---------------------------------------------------------------------------
-- Hand-appended: RLS lockdown on the new public tables (no policies => the anon
-- key gets zero access; all reads/writes go through the server role). Matches
-- the pattern in 0001 / 0007.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."guides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."guide_blocks" ENABLE ROW LEVEL SECURITY;
