ALTER TYPE "public"."property_status" ADD VALUE 'trial' BEFORE 'rented';--> statement-breakpoint
ALTER TABLE "property_assignments" ADD COLUMN "is_trial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "property_assignments" ADD COLUMN "trial_ends_on" date;--> statement-breakpoint
ALTER TABLE "property_assignments" ADD CONSTRAINT "property_assignments_trial_ends_on" CHECK (not "property_assignments"."is_trial" or "property_assignments"."trial_ends_on" is not null);