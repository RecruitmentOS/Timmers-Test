CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'completed');--> statement-breakpoint
ALTER TYPE "public"."vacancy_status" ADD VALUE 'archived';--> statement-breakpoint
CREATE TABLE "placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"client_id" uuid,
	"agreed_rate" numeric(8, 2),
	"inlenersbeloning" boolean DEFAULT false NOT NULL,
	"start_date" timestamp,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "placements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "application_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"label" varchar(50) NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "application_tags_app_label_unique" UNIQUE("application_id","label")
);
--> statement-breakpoint
ALTER TABLE "application_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_auto_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"trigger_stage_id" uuid NOT NULL,
	"title_template" varchar(255) NOT NULL,
	"due_offset_days" integer DEFAULT 3 NOT NULL,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_auto_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"candidate_id" uuid,
	"vacancy_id" uuid,
	"client_id" uuid,
	"assigned_to_user_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"due_date" timestamp,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"completed_at" timestamp,
	"completed_by_user_id" text,
	"auto_created_from_stage_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_exactly_one_parent" CHECK ((("tasks"."candidate_id" IS NOT NULL)::int + ("tasks"."vacancy_id" IS NOT NULL)::int + ("tasks"."client_id" IS NOT NULL)::int) = 1)
);
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"mentions" jsonb DEFAULT '[]'::jsonb,
	"kind" varchar(20) DEFAULT 'comment' NOT NULL,
	"feedback_thumb" varchar(10),
	"is_internal" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"email_mentions" boolean DEFAULT true NOT NULL,
	"email_assignments" boolean DEFAULT true NOT NULL,
	"email_task_reminders" boolean DEFAULT true NOT NULL,
	"email_document_expiry" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" varchar(30) NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "driver_qualifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"adr_type" varchar(20),
	"card_number" varchar(50),
	"issued_at" date,
	"expires_at" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "driver_qualifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cv_parse_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"candidate_id" uuid,
	"input_tokens" integer,
	"output_tokens" integer,
	"model_id" varchar(100),
	"duration_ms" integer,
	"status" varchar(20) NOT NULL,
	"error_message" text,
	"parsed_data" jsonb,
	"content_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cv_parse_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenant_billing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"stripe_customer_id" text,
	"subscription_id" text,
	"plan_tier" varchar(20) DEFAULT 'starter' NOT NULL,
	"trial_ends_at" timestamp,
	"status" varchar(20) DEFAULT 'trialing' NOT NULL,
	"current_active_users" integer DEFAULT 0 NOT NULL,
	"current_active_vacancies" integer DEFAULT 0 NOT NULL,
	"current_placements" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_billing_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "tenant_billing_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "qualification_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"criteria" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "qualification_presets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "campaign_daily_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"date" date NOT NULL,
	"spend_cents" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"actions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_daily_metrics_campaign_date_uq" UNIQUE("campaign_id","date")
);
--> statement-breakpoint
ALTER TABLE "campaign_daily_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"channel" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"budget_cents" integer,
	"currency" varchar(3) DEFAULT 'EUR',
	"start_date" date,
	"end_date" date,
	"meta_campaign_id" varchar(100),
	"meta_adset_id" varchar(100),
	"spend_cents" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "meta_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"meta_ad_account_id" varchar(100) NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meta_connections_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "persona_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vacancy_id" uuid,
	"name" varchar(255) NOT NULL,
	"candidate_criteria" jsonb NOT NULL,
	"targeting_template_id" uuid,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "persona_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "targeting_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"targeting_spec" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "targeting_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_screening_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"verdict" varchar(10),
	"reasoning" text,
	"confidence" varchar(10),
	"matched_criteria" jsonb,
	"missing_criteria" jsonb,
	"input_tokens" integer,
	"output_tokens" integer,
	"model_id" varchar(100),
	"duration_ms" integer,
	"content_hash" varchar(128),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_screening_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"month_key" varchar(7) NOT NULL,
	"screening_count" integer DEFAULT 0 NOT NULL,
	"screening_tokens" integer DEFAULT 0 NOT NULL,
	"parse_count" integer DEFAULT 0 NOT NULL,
	"parse_tokens" integer DEFAULT 0 NOT NULL,
	"quota_limit" integer DEFAULT 500 NOT NULL,
	"quota_notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_org_month_unique" UNIQUE("organization_id","month_key")
);
--> statement-breakpoint
CREATE TABLE "calendar_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"provider" varchar(20) NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"token_expires_at" timestamp,
	"calendar_email" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"scheduled_by" text NOT NULL,
	"calendar_connection_id" uuid,
	"calendar_event_id" varchar(255),
	"scheduled_at" timestamp NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"location" text,
	"notes" text,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "external_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" varchar(40) NOT NULL,
	"api_key_encrypted" text,
	"api_base_url" text,
	"additional_config" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "external_integrations_organization_id_provider_unique" UNIQUE("organization_id","provider")
);
--> statement-breakpoint
ALTER TABLE "external_integrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "intake_messages" (
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
ALTER TABLE "intake_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "intake_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"state" varchar(30) NOT NULL,
	"verdict" varchar(20),
	"verdict_reason" text,
	"must_have_answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"nice_to_have_answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stuck_counter" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"claude_thread_id" text,
	"last_inbound_at" timestamp,
	"last_outbound_at" timestamp,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"match_score" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "intake_sessions_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
ALTER TABLE "intake_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "intake_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"variant" varchar(30) NOT NULL,
	"locale" varchar(5) DEFAULT 'nl' NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"waba_status" varchar(20) DEFAULT 'sandbox' NOT NULL,
	"waba_content_sid" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "intake_templates_organization_id_variant_locale_unique" UNIQUE("organization_id","variant","locale")
);
--> statement-breakpoint
ALTER TABLE "intake_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fleks_sync_cursors" (
	"organization_id" uuid NOT NULL,
	"entity_type" varchar(30) NOT NULL,
	"last_updated_at" timestamp,
	"last_seen_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_sync_at" timestamp,
	"last_error_at" timestamp,
	"last_error" text,
	CONSTRAINT "fleks_sync_cursors_organization_id_entity_type_pk" PRIMARY KEY("organization_id","entity_type")
);
--> statement-breakpoint
ALTER TABLE "fleks_sync_cursors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "language" varchar(5) DEFAULT 'nl' NOT NULL;--> statement-breakpoint
ALTER TABLE "vacancies" ADD COLUMN "slug" varchar(255);--> statement-breakpoint
ALTER TABLE "vacancies" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "vacancies" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "vacancies" ADD COLUMN "geocoded_at" timestamp;--> statement-breakpoint
ALTER TABLE "vacancies" ADD COLUMN "required_licenses" jsonb;--> statement-breakpoint
ALTER TABLE "vacancies" ADD COLUMN "distribution_channels" jsonb;--> statement-breakpoint
ALTER TABLE "vacancies" ADD COLUMN "hourly_rate" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "vacancies" ADD COLUMN "intake_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vacancies" ADD COLUMN "fleks_job_uuid" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "geocoded_at" timestamp;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "availability_type" varchar(30);--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "availability_start_date" timestamp;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "contract_type" varchar(30);--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "fleks_employee_uuid" text;--> statement-breakpoint
ALTER TABLE "candidate_applications" ADD COLUMN "sent_to_hiring_manager" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_applications" ADD COLUMN "reject_reason" text;--> statement-breakpoint
ALTER TABLE "candidate_applications" ADD COLUMN "match_score" integer;--> statement-breakpoint
ALTER TABLE "candidate_applications" ADD COLUMN "qualification_notes" text;--> statement-breakpoint
ALTER TABLE "candidate_applications" ADD COLUMN "utm_source" varchar(255);--> statement-breakpoint
ALTER TABLE "candidate_applications" ADD COLUMN "utm_medium" varchar(255);--> statement-breakpoint
ALTER TABLE "candidate_applications" ADD COLUMN "utm_campaign" varchar(255);--> statement-breakpoint
ALTER TABLE "file_metadata" ADD COLUMN "document_type" varchar(20);--> statement-breakpoint
ALTER TABLE "file_metadata" ADD COLUMN "expires_at" date;--> statement-breakpoint
ALTER TABLE "file_metadata" ADD COLUMN "content_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_application_id_candidate_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."candidate_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_tags" ADD CONSTRAINT "application_tags_application_id_candidate_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."candidate_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_tags" ADD CONSTRAINT "application_tags_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_auto_rules" ADD CONSTRAINT "task_auto_rules_trigger_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("trigger_stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_user_id_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_user_id_user_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_auto_created_from_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("auto_created_from_stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_qualifications" ADD CONSTRAINT "driver_qualifications_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_parse_logs" ADD CONSTRAINT "cv_parse_logs_file_id_file_metadata_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file_metadata"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_parse_logs" ADD CONSTRAINT "cv_parse_logs_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_billing" ADD CONSTRAINT "tenant_billing_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_daily_metrics" ADD CONSTRAINT "campaign_daily_metrics_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_templates" ADD CONSTRAINT "persona_templates_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_templates" ADD CONSTRAINT "persona_templates_targeting_template_id_targeting_templates_id_fk" FOREIGN KEY ("targeting_template_id") REFERENCES "public"."targeting_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_templates" ADD CONSTRAINT "persona_templates_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targeting_templates" ADD CONSTRAINT "targeting_templates_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_screening_logs" ADD CONSTRAINT "ai_screening_logs_application_id_candidate_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."candidate_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_screening_logs" ADD CONSTRAINT "ai_screening_logs_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_screening_logs" ADD CONSTRAINT "ai_screening_logs_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_candidate_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."candidate_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_scheduled_by_user_id_fk" FOREIGN KEY ("scheduled_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_calendar_connection_id_calendar_connections_id_fk" FOREIGN KEY ("calendar_connection_id") REFERENCES "public"."calendar_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_messages" ADD CONSTRAINT "intake_messages_session_id_intake_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."intake_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_sessions" ADD CONSTRAINT "intake_sessions_application_id_candidate_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."candidate_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_applications" ADD CONSTRAINT "candidate_applications_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "placements_tenant_select" ON "placements" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "placements_tenant_insert" ON "placements" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "placements_tenant_update" ON "placements" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "placements_tenant_delete" ON "placements" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "application_tags_tenant_select" ON "application_tags" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "application_tags_tenant_insert" ON "application_tags" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "application_tags_tenant_update" ON "application_tags" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "application_tags_tenant_delete" ON "application_tags" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "task_auto_rules_tenant_select" ON "task_auto_rules" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "task_auto_rules_tenant_insert" ON "task_auto_rules" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "task_auto_rules_tenant_update" ON "task_auto_rules" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "task_auto_rules_tenant_delete" ON "task_auto_rules" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tasks_tenant_select" ON "tasks" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tasks_tenant_insert" ON "tasks" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tasks_tenant_update" ON "tasks" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tasks_tenant_delete" ON "tasks" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "comments_tenant_select" ON "comments" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "comments_tenant_insert" ON "comments" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "comments_tenant_update" ON "comments" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "comments_tenant_delete" ON "comments" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "notifications_tenant_select" ON "notifications" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "notifications_tenant_insert" ON "notifications" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "notifications_tenant_update" ON "notifications" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "notifications_tenant_delete" ON "notifications" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "driver_qualifications_tenant_select" ON "driver_qualifications" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "driver_qualifications_tenant_insert" ON "driver_qualifications" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "driver_qualifications_tenant_update" ON "driver_qualifications" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "driver_qualifications_tenant_delete" ON "driver_qualifications" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "cv_parse_logs_tenant_select" ON "cv_parse_logs" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "cv_parse_logs_tenant_insert" ON "cv_parse_logs" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "cv_parse_logs_tenant_update" ON "cv_parse_logs" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "cv_parse_logs_tenant_delete" ON "cv_parse_logs" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "qualification_presets_tenant_select" ON "qualification_presets" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "qualification_presets_tenant_insert" ON "qualification_presets" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "qualification_presets_tenant_update" ON "qualification_presets" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "qualification_presets_tenant_delete" ON "qualification_presets" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "campaign_daily_metrics_tenant_select" ON "campaign_daily_metrics" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "campaign_daily_metrics_tenant_insert" ON "campaign_daily_metrics" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "campaign_daily_metrics_tenant_update" ON "campaign_daily_metrics" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "campaign_daily_metrics_tenant_delete" ON "campaign_daily_metrics" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "campaigns_tenant_select" ON "campaigns" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "campaigns_tenant_insert" ON "campaigns" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "campaigns_tenant_update" ON "campaigns" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "campaigns_tenant_delete" ON "campaigns" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "persona_templates_tenant_select" ON "persona_templates" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "persona_templates_tenant_insert" ON "persona_templates" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "persona_templates_tenant_update" ON "persona_templates" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "persona_templates_tenant_delete" ON "persona_templates" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "targeting_templates_tenant_select" ON "targeting_templates" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "targeting_templates_tenant_insert" ON "targeting_templates" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "targeting_templates_tenant_update" ON "targeting_templates" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "targeting_templates_tenant_delete" ON "targeting_templates" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "ai_screening_logs_tenant_select" ON "ai_screening_logs" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "ai_screening_logs_tenant_insert" ON "ai_screening_logs" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "ai_screening_logs_tenant_update" ON "ai_screening_logs" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "ai_screening_logs_tenant_delete" ON "ai_screening_logs" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "calendar_connections_tenant_select" ON "calendar_connections" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "calendar_connections_tenant_insert" ON "calendar_connections" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "calendar_connections_tenant_update" ON "calendar_connections" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "calendar_connections_tenant_delete" ON "calendar_connections" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "interviews_tenant_select" ON "interviews" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "interviews_tenant_insert" ON "interviews" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "interviews_tenant_update" ON "interviews" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "interviews_tenant_delete" ON "interviews" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "external_integrations_tenant_select" ON "external_integrations" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "external_integrations_tenant_insert" ON "external_integrations" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "external_integrations_tenant_update" ON "external_integrations" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "external_integrations_tenant_delete" ON "external_integrations" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "intake_messages_tenant_select" ON "intake_messages" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "intake_messages_tenant_insert" ON "intake_messages" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "intake_messages_tenant_update" ON "intake_messages" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "intake_messages_tenant_delete" ON "intake_messages" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "intake_sessions_tenant_select" ON "intake_sessions" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "intake_sessions_tenant_insert" ON "intake_sessions" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "intake_sessions_tenant_update" ON "intake_sessions" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "intake_sessions_tenant_delete" ON "intake_sessions" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "intake_templates_tenant_select" ON "intake_templates" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "intake_templates_tenant_insert" ON "intake_templates" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "intake_templates_tenant_update" ON "intake_templates" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "intake_templates_tenant_delete" ON "intake_templates" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "fleks_sync_cursors_tenant_select" ON "fleks_sync_cursors" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "fleks_sync_cursors_tenant_insert" ON "fleks_sync_cursors" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "fleks_sync_cursors_tenant_update" ON "fleks_sync_cursors" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "fleks_sync_cursors_tenant_delete" ON "fleks_sync_cursors" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);