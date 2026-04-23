CREATE TABLE "nilo_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"flow_id" uuid,
	"application_id" uuid,
	"contact_phone" varchar(30) NOT NULL,
	"contact_name" text,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state" varchar(30) DEFAULT 'created' NOT NULL,
	"verdict" varchar(20),
	"verdict_reason" text,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stuck_counter" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"match_score" integer,
	"outbound_webhook_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"initiated_at" timestamp,
	"completed_at" timestamp,
	"last_inbound_at" timestamp,
	"last_outbound_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "nilo_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nilo_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"direction" varchar(10) NOT NULL,
	"body" text NOT NULL,
	"twilio_sid" text,
	"is_from_bot" boolean DEFAULT true NOT NULL,
	"tool_calls" jsonb,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nilo_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nilo_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "nilo_api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nilo_trigger_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_ref" text,
	"payload" jsonb NOT NULL,
	"session_id" uuid,
	"received_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nilo_trigger_events_dedup" UNIQUE("organization_id","external_ref")
);
--> statement-breakpoint
ALTER TABLE "nilo_trigger_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nilo_webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"target_url" text NOT NULL,
	"payload" jsonb NOT NULL,
	"response_status" integer,
	"attempt" integer DEFAULT 1 NOT NULL,
	"error" text,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nilo_webhook_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nilo_handoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"reason" varchar(40) NOT NULL,
	"context" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"assigned_to" uuid,
	"accepted_at" timestamp,
	"resolved_at" timestamp,
	"resolution" varchar(30)
);
--> statement-breakpoint
ALTER TABLE "nilo_handoffs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "nilo_sessions" ADD CONSTRAINT "nilo_sessions_application_id_candidate_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."candidate_applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nilo_messages" ADD CONSTRAINT "nilo_messages_session_id_nilo_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."nilo_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nilo_trigger_events" ADD CONSTRAINT "nilo_trigger_events_session_id_nilo_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."nilo_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nilo_webhook_logs" ADD CONSTRAINT "nilo_webhook_logs_session_id_nilo_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."nilo_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nilo_handoffs" ADD CONSTRAINT "nilo_handoffs_session_id_nilo_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."nilo_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "nilo_sessions_tenant_select" ON "nilo_sessions" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_sessions_tenant_insert" ON "nilo_sessions" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_sessions_tenant_update" ON "nilo_sessions" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_sessions_tenant_delete" ON "nilo_sessions" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_messages_tenant_select" ON "nilo_messages" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_messages_tenant_insert" ON "nilo_messages" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_messages_tenant_update" ON "nilo_messages" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_messages_tenant_delete" ON "nilo_messages" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_api_keys_tenant_select" ON "nilo_api_keys" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_api_keys_tenant_insert" ON "nilo_api_keys" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_api_keys_tenant_update" ON "nilo_api_keys" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_api_keys_tenant_delete" ON "nilo_api_keys" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_trigger_events_tenant_select" ON "nilo_trigger_events" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_trigger_events_tenant_insert" ON "nilo_trigger_events" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_trigger_events_tenant_update" ON "nilo_trigger_events" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_trigger_events_tenant_delete" ON "nilo_trigger_events" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_webhook_logs_tenant_select" ON "nilo_webhook_logs" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_webhook_logs_tenant_insert" ON "nilo_webhook_logs" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_webhook_logs_tenant_update" ON "nilo_webhook_logs" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_webhook_logs_tenant_delete" ON "nilo_webhook_logs" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_handoffs_tenant_select" ON "nilo_handoffs" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_handoffs_tenant_insert" ON "nilo_handoffs" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_handoffs_tenant_update" ON "nilo_handoffs" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "nilo_handoffs_tenant_delete" ON "nilo_handoffs" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);