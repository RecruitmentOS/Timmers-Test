CREATE TYPE "public"."vacancy_status" AS ENUM('draft', 'active', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "public"."qualification_status" AS ENUM('pending', 'yes', 'maybe', 'no');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"inviter_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"active_organization_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pipeline_stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_person" varchar(255),
	"contact_email" varchar(255),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "client_vacancy_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_vacancy_access" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vacancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"location" varchar(255),
	"employment_type" varchar(50),
	"status" "vacancy_status" DEFAULT 'draft' NOT NULL,
	"owner_id" text NOT NULL,
	"client_id" uuid,
	"qualification_criteria" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "vacancies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vacancy_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vacancy_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vacancy_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vacancy_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"phone" varchar(50),
	"email" varchar(255),
	"city" varchar(255),
	"source" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "candidates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "application_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"from_stage_id" uuid,
	"to_stage_id" uuid NOT NULL,
	"moved_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_stage_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "candidate_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"current_stage_id" uuid,
	"owner_id" text NOT NULL,
	"qualification_status" "qualification_status" DEFAULT 'pending' NOT NULL,
	"source_detail" varchar(255),
	"campaign_id" uuid,
	"assigned_agent_id" text,
	"sent_to_client" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidate_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "file_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"size_bytes" integer,
	"s3_key" varchar(500) NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "file_metadata" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"actor_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "client_user_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"client_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_user_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_vacancy_access" ADD CONSTRAINT "client_vacancy_access_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_vacancy_access" ADD CONSTRAINT "client_vacancy_access_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancy_assignments" ADD CONSTRAINT "vacancy_assignments_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancy_assignments" ADD CONSTRAINT "vacancy_assignments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancy_notes" ADD CONSTRAINT "vacancy_notes_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancy_notes" ADD CONSTRAINT "vacancy_notes_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_stage_history" ADD CONSTRAINT "application_stage_history_application_id_candidate_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."candidate_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_stage_history" ADD CONSTRAINT "application_stage_history_from_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("from_stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_stage_history" ADD CONSTRAINT "application_stage_history_to_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("to_stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_stage_history" ADD CONSTRAINT "application_stage_history_moved_by_user_id_fk" FOREIGN KEY ("moved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_applications" ADD CONSTRAINT "candidate_applications_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_applications" ADD CONSTRAINT "candidate_applications_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_applications" ADD CONSTRAINT "candidate_applications_current_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("current_stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_applications" ADD CONSTRAINT "candidate_applications_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_applications" ADD CONSTRAINT "candidate_applications_assigned_agent_id_user_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_metadata" ADD CONSTRAINT "file_metadata_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_user_assignments" ADD CONSTRAINT "client_user_assignments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_user_assignments" ADD CONSTRAINT "client_user_assignments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "pipeline_stages_tenant_select" ON "pipeline_stages" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "pipeline_stages_tenant_insert" ON "pipeline_stages" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "pipeline_stages_tenant_update" ON "pipeline_stages" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "pipeline_stages_tenant_delete" ON "pipeline_stages" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "clients_tenant_select" ON "clients" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "clients_tenant_insert" ON "clients" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "clients_tenant_update" ON "clients" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "clients_tenant_delete" ON "clients" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "client_vacancy_access_tenant_select" ON "client_vacancy_access" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "client_vacancy_access_tenant_insert" ON "client_vacancy_access" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "client_vacancy_access_tenant_update" ON "client_vacancy_access" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "client_vacancy_access_tenant_delete" ON "client_vacancy_access" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "vacancies_tenant_select" ON "vacancies" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "vacancies_tenant_insert" ON "vacancies" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "vacancies_tenant_update" ON "vacancies" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "vacancies_tenant_delete" ON "vacancies" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "vacancy_assignments_tenant_select" ON "vacancy_assignments" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "vacancy_assignments_tenant_insert" ON "vacancy_assignments" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "vacancy_assignments_tenant_update" ON "vacancy_assignments" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "vacancy_assignments_tenant_delete" ON "vacancy_assignments" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "vacancy_notes_tenant_select" ON "vacancy_notes" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "vacancy_notes_tenant_insert" ON "vacancy_notes" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "vacancy_notes_tenant_update" ON "vacancy_notes" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "vacancy_notes_tenant_delete" ON "vacancy_notes" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "candidates_tenant_select" ON "candidates" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "candidates_tenant_insert" ON "candidates" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "candidates_tenant_update" ON "candidates" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "candidates_tenant_delete" ON "candidates" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "application_stage_history_tenant_select" ON "application_stage_history" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "application_stage_history_tenant_insert" ON "application_stage_history" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "application_stage_history_tenant_update" ON "application_stage_history" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "application_stage_history_tenant_delete" ON "application_stage_history" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "candidate_applications_tenant_select" ON "candidate_applications" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "candidate_applications_tenant_insert" ON "candidate_applications" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "candidate_applications_tenant_update" ON "candidate_applications" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "candidate_applications_tenant_delete" ON "candidate_applications" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "file_metadata_tenant_select" ON "file_metadata" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "file_metadata_tenant_insert" ON "file_metadata" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "file_metadata_tenant_update" ON "file_metadata" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "file_metadata_tenant_delete" ON "file_metadata" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "activity_log_tenant_select" ON "activity_log" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "activity_log_tenant_insert" ON "activity_log" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "activity_log_tenant_update" ON "activity_log" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "activity_log_tenant_delete" ON "activity_log" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "client_user_assignments_tenant_select" ON "client_user_assignments" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "client_user_assignments_tenant_insert" ON "client_user_assignments" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "client_user_assignments_tenant_update" ON "client_user_assignments" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "client_user_assignments_tenant_delete" ON "client_user_assignments" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);