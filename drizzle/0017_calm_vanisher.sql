CREATE TABLE "guide_step_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"guide_slug" text NOT NULL,
	"step_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guide_step_progress" ADD CONSTRAINT "guide_step_progress_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guide_step_progress_uniq" ON "guide_step_progress" USING btree ("profile_id","guide_slug","step_key");--> statement-breakpoint
CREATE INDEX "guide_step_progress_user_guide_idx" ON "guide_step_progress" USING btree ("profile_id","guide_slug");