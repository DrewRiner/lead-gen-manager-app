CREATE TYPE "public"."billable_status" AS ENUM('billable', 'not_billable', 'disputed', 'pending_review', 'spam');--> statement-breakpoint
CREATE TYPE "public"."billing_type" AS ENUM('flat_monthly', 'per_lead', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('active', 'paused', 'churned');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('new', 'delivered', 'billed');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('organic', 'gbp', 'direct', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_type" AS ENUM('call', 'form');--> statement-breakpoint
CREATE TYPE "public"."property_status" AS ENUM('active', 'available', 'rented', 'paused');--> statement-breakpoint
CREATE TYPE "public"."qualified_by" AS ENUM('duration_rule', 'manual', 'ai');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"org_timezone" text DEFAULT 'America/New_York' NOT NULL,
	"default_billable_threshold_seconds" integer DEFAULT 60 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_singleton" CHECK ("app_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"client_id" uuid,
	"type" "lead_type" NOT NULL,
	"source" "lead_source" DEFAULT 'organic' NOT NULL,
	"caller_name" text,
	"caller_phone" text,
	"caller_email" text,
	"message" text,
	"call_duration_seconds" integer,
	"recording_url" text,
	"billable_status" "billable_status" NOT NULL,
	"billable_reason" text,
	"qualified_by" "qualified_by",
	"billed_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"estimated_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"delivery_status" "delivery_status" DEFAULT 'new' NOT NULL,
	"source_system" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"raw_payload" jsonb,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"role" "role" DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text,
	"domain" text,
	"niche" text,
	"city" text,
	"state" text,
	"status" "property_status" DEFAULT 'available' NOT NULL,
	"gbp_place_id" text,
	"tracking_phone" text,
	"client_id" uuid,
	"billing_type" "billing_type" DEFAULT 'flat_monthly' NOT NULL,
	"monthly_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"per_lead_call_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"per_lead_form_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"estimated_call_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"estimated_form_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"billable_threshold_seconds" integer DEFAULT 60 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "leads_source_system_external_id_uniq" ON "leads" USING btree ("source_system","external_id") WHERE "leads"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "leads_property_id_occurred_at_idx" ON "leads" USING btree ("property_id","occurred_at");--> statement-breakpoint
CREATE INDEX "leads_occurred_at_idx" ON "leads" USING btree ("occurred_at");