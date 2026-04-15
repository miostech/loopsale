CREATE TABLE "abandoned_checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"checkout_event_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"platform_checkout_id" text NOT NULL,
	"customer_email" text,
	"customer_phone" text,
	"product_id" text,
	"product_name" text,
	"amount" numeric(12, 2),
	"recovered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkout_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"event_type" text NOT NULL,
	"platform_checkout_id" text,
	"platform_order_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"customer_email" text,
	"customer_phone" text,
	"product_id" text,
	"product_name" text,
	"amount" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"platform_product_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recovery_flow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recovery_flow_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"delay_minutes" integer NOT NULL,
	"channel" text NOT NULL,
	"template_id" text,
	"template_body" text,
	"coupon_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recovery_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"product_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"abandonment_minutes" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_recovery_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"abandoned_checkout_id" uuid NOT NULL,
	"recovery_flow_step_id" uuid NOT NULL,
	"run_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "abandoned_checkouts" ADD CONSTRAINT "abandoned_checkouts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abandoned_checkouts" ADD CONSTRAINT "abandoned_checkouts_checkout_event_id_checkout_events_id_fk" FOREIGN KEY ("checkout_event_id") REFERENCES "public"."checkout_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_events" ADD CONSTRAINT "checkout_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_flow_steps" ADD CONSTRAINT "recovery_flow_steps_recovery_flow_id_recovery_flows_id_fk" FOREIGN KEY ("recovery_flow_id") REFERENCES "public"."recovery_flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_flows" ADD CONSTRAINT "recovery_flows_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_flows" ADD CONSTRAINT "recovery_flows_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_recovery_messages" ADD CONSTRAINT "scheduled_recovery_messages_abandoned_checkout_id_abandoned_checkouts_id_fk" FOREIGN KEY ("abandoned_checkout_id") REFERENCES "public"."abandoned_checkouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_recovery_messages" ADD CONSTRAINT "scheduled_recovery_messages_recovery_flow_step_id_recovery_flow_steps_id_fk" FOREIGN KEY ("recovery_flow_step_id") REFERENCES "public"."recovery_flow_steps"("id") ON DELETE no action ON UPDATE no action;