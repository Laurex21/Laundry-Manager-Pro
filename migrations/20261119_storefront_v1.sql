BEGIN;
CREATE TABLE "storefront_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"actor_id" varchar,
	"action" text NOT NULL,
	"version" integer NOT NULL,
	"note" text,
	"quote" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "storefront_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" varchar(32) NOT NULL,
	"storefront_id" integer NOT NULL,
	"site_id" integer NOT NULL,
	"organisation_id" integer NOT NULL,
	"request_key" uuid NOT NULL,
	"tracking_hash" varchar(64) NOT NULL,
	"body_fingerprint" varchar(64) NOT NULL,
	"customer_name" text NOT NULL,
	"phone" varchar(20) NOT NULL,
	"note" text NOT NULL,
	"lines" jsonb NOT NULL,
	"service_snapshot" jsonb NOT NULL,
	"weight_snapshot" jsonb NOT NULL,
	"estimate" jsonb NOT NULL,
	"final_quote" jsonb,
	"status" text DEFAULT 'submitted' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"accepted_version" integer,
	"received_at" timestamp with time zone,
	"converted_order_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storefront_requests_reference_unique" UNIQUE("reference"),
	CONSTRAINT "storefront_requests_tracking_hash_unique" UNIQUE("tracking_hash"),
	CONSTRAINT "storefront_requests_converted_order_id_unique" UNIQUE("converted_order_id"),
	CONSTRAINT "storefront_request_status" CHECK ("storefront_requests"."status" IN ('submitted','awaiting_dropoff','awaiting_customer_approval','ready_to_convert','converted','rejected','cancelled')),
	CONSTRAINT "storefront_request_version" CHECK ("storefront_requests"."version" > 0)
);

CREATE TABLE "storefront_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"storefront_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"mode" text NOT NULL,
	CONSTRAINT "storefront_service_mode" CHECK ("storefront_services"."mode" IN ('piece','kg','quote'))
);

CREATE TABLE "storefronts" (
	"id" serial PRIMARY KEY NOT NULL,
	"organisation_id" integer NOT NULL,
	"site_id" integer NOT NULL,
	"slug" varchar(70) NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"address" text NOT NULL,
	"hours" text NOT NULL,
	"whatsapp" varchar(20) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"weights_acknowledged" boolean DEFAULT false NOT NULL,
	"weights" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"minimum_adjustment_service_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storefronts_site_id_unique" UNIQUE("site_id"),
	CONSTRAINT "storefronts_slug_unique" UNIQUE("slug"),
	CONSTRAINT "storefront_version_positive" CHECK ("storefronts"."version" > 0)
);

ALTER TABLE "storefront_events" ADD CONSTRAINT "storefront_events_request_id_storefront_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."storefront_requests"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "storefront_events" ADD CONSTRAINT "storefront_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "storefront_requests" ADD CONSTRAINT "storefront_requests_storefront_id_storefronts_id_fk" FOREIGN KEY ("storefront_id") REFERENCES "public"."storefronts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "storefront_requests" ADD CONSTRAINT "storefront_requests_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "storefront_requests" ADD CONSTRAINT "storefront_requests_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "storefront_requests" ADD CONSTRAINT "storefront_requests_converted_order_id_orders_id_fk" FOREIGN KEY ("converted_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "storefront_services" ADD CONSTRAINT "storefront_services_storefront_id_storefronts_id_fk" FOREIGN KEY ("storefront_id") REFERENCES "public"."storefronts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "storefront_services" ADD CONSTRAINT "storefront_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "storefronts" ADD CONSTRAINT "storefronts_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "storefronts" ADD CONSTRAINT "storefronts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "storefronts" ADD CONSTRAINT "storefronts_minimum_adjustment_service_id_services_id_fk" FOREIGN KEY ("minimum_adjustment_service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "storefront_event_request" ON "storefront_events" USING btree ("request_id","id");
CREATE UNIQUE INDEX "storefront_request_idempotency" ON "storefront_requests" USING btree ("storefront_id","request_key");
CREATE INDEX "storefront_request_inbox" ON "storefront_requests" USING btree ("site_id","created_at");
CREATE UNIQUE INDEX "storefront_service_unique" ON "storefront_services" USING btree ("storefront_id","service_id");
COMMIT;
