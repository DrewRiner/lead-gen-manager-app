CREATE TABLE "property_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"started_on" date NOT NULL,
	"ended_on" date,
	"billing_type" "billing_type" NOT NULL,
	"monthly_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"per_lead_call_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"per_lead_form_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "property_assignments" ADD CONSTRAINT "property_assignments_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_assignments" ADD CONSTRAINT "property_assignments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_assignments_active_uniq" ON "property_assignments" USING btree ("property_id") WHERE "property_assignments"."ended_on" is null;--> statement-breakpoint
CREATE INDEX "property_assignments_property_id_idx" ON "property_assignments" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_assignments_client_id_idx" ON "property_assignments" USING btree ("client_id");