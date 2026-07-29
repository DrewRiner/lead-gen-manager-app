ALTER TYPE "public"."qualified_by" ADD VALUE 'spam_rule';--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "spam_score_threshold" integer DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "submitter_ip" text;--> statement-breakpoint
CREATE INDEX "leads_caller_email_occurred_at_idx" ON "leads" USING btree ("caller_email","occurred_at");--> statement-breakpoint
CREATE INDEX "leads_caller_phone_occurred_at_idx" ON "leads" USING btree ("caller_phone","occurred_at");--> statement-breakpoint
CREATE INDEX "leads_submitter_ip_occurred_at_idx" ON "leads" USING btree ("submitter_ip","occurred_at");