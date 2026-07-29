ALTER TABLE "leads" ADD COLUMN "call_answered" boolean;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "is_repeat_caller" boolean;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "transcript" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "callrail_call_id" text;