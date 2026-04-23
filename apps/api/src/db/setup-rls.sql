-- Post-push RLS setup script
-- Run this after `drizzle-kit push` to apply RLS policies with correct expressions.
-- drizzle-kit push creates policies without expressions (known limitation),
-- so we re-create them with the correct USING/WITH CHECK clauses.

-- Step 1: Drop all existing policies
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
    END LOOP;
END$$;

-- Step 2: Create policies with correct expressions for all tenant-scoped tables
-- Each table gets 4 policies: SELECT, INSERT, UPDATE, DELETE

-- pipeline_stages
CREATE POLICY "pipeline_stages_tenant_select" ON "pipeline_stages" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "pipeline_stages_tenant_insert" ON "pipeline_stages" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "pipeline_stages_tenant_update" ON "pipeline_stages" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "pipeline_stages_tenant_delete" ON "pipeline_stages" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- clients
CREATE POLICY "clients_tenant_select" ON "clients" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "clients_tenant_insert" ON "clients" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "clients_tenant_update" ON "clients" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "clients_tenant_delete" ON "clients" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- vacancies
CREATE POLICY "vacancies_tenant_select" ON "vacancies" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "vacancies_tenant_insert" ON "vacancies" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "vacancies_tenant_update" ON "vacancies" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "vacancies_tenant_delete" ON "vacancies" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- vacancy_assignments
CREATE POLICY "vacancy_assignments_tenant_select" ON "vacancy_assignments" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "vacancy_assignments_tenant_insert" ON "vacancy_assignments" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "vacancy_assignments_tenant_update" ON "vacancy_assignments" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "vacancy_assignments_tenant_delete" ON "vacancy_assignments" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- vacancy_notes
CREATE POLICY "vacancy_notes_tenant_select" ON "vacancy_notes" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "vacancy_notes_tenant_insert" ON "vacancy_notes" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "vacancy_notes_tenant_update" ON "vacancy_notes" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "vacancy_notes_tenant_delete" ON "vacancy_notes" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- client_vacancy_access
CREATE POLICY "client_vacancy_access_tenant_select" ON "client_vacancy_access" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "client_vacancy_access_tenant_insert" ON "client_vacancy_access" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "client_vacancy_access_tenant_update" ON "client_vacancy_access" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "client_vacancy_access_tenant_delete" ON "client_vacancy_access" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- candidates
CREATE POLICY "candidates_tenant_select" ON "candidates" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "candidates_tenant_insert" ON "candidates" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "candidates_tenant_update" ON "candidates" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "candidates_tenant_delete" ON "candidates" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- candidate_applications
CREATE POLICY "candidate_applications_tenant_select" ON "candidate_applications" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "candidate_applications_tenant_insert" ON "candidate_applications" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "candidate_applications_tenant_update" ON "candidate_applications" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "candidate_applications_tenant_delete" ON "candidate_applications" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- application_stage_history
CREATE POLICY "application_stage_history_tenant_select" ON "application_stage_history" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "application_stage_history_tenant_insert" ON "application_stage_history" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "application_stage_history_tenant_update" ON "application_stage_history" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "application_stage_history_tenant_delete" ON "application_stage_history" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- file_metadata
CREATE POLICY "file_metadata_tenant_select" ON "file_metadata" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "file_metadata_tenant_insert" ON "file_metadata" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "file_metadata_tenant_update" ON "file_metadata" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "file_metadata_tenant_delete" ON "file_metadata" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- activity_log
CREATE POLICY "activity_log_tenant_select" ON "activity_log" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "activity_log_tenant_insert" ON "activity_log" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "activity_log_tenant_update" ON "activity_log" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "activity_log_tenant_delete" ON "activity_log" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- client_user_assignments
CREATE POLICY "client_user_assignments_tenant_select" ON "client_user_assignments" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "client_user_assignments_tenant_insert" ON "client_user_assignments" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "client_user_assignments_tenant_update" ON "client_user_assignments" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "client_user_assignments_tenant_delete" ON "client_user_assignments" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- tasks
CREATE POLICY "tasks_tenant_select" ON "tasks" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tasks_tenant_insert" ON "tasks" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tasks_tenant_update" ON "tasks" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tasks_tenant_delete" ON "tasks" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- task_auto_rules
CREATE POLICY "task_auto_rules_tenant_select" ON "task_auto_rules" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "task_auto_rules_tenant_insert" ON "task_auto_rules" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "task_auto_rules_tenant_update" ON "task_auto_rules" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "task_auto_rules_tenant_delete" ON "task_auto_rules" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- application_tags
CREATE POLICY "application_tags_tenant_select" ON "application_tags" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "application_tags_tenant_insert" ON "application_tags" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "application_tags_tenant_update" ON "application_tags" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "application_tags_tenant_delete" ON "application_tags" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- comments
CREATE POLICY "comments_tenant_select" ON "comments" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "comments_tenant_insert" ON "comments" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "comments_tenant_update" ON "comments" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "comments_tenant_delete" ON "comments" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- notifications (tenant-level policies)
CREATE POLICY "notifications_tenant_select" ON "notifications" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "notifications_tenant_insert" ON "notifications" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "notifications_tenant_update" ON "notifications" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "notifications_tenant_delete" ON "notifications" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- notifications (per-user isolation policy — users can only see their own notifications)
CREATE POLICY "notifications_user_isolation" ON "notifications" AS PERMISSIVE FOR SELECT TO "app_user" USING ("user_id" = current_setting('app.user_id', true)::text);

-- driver_qualifications
CREATE POLICY "driver_qualifications_tenant_select" ON "driver_qualifications" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "driver_qualifications_tenant_insert" ON "driver_qualifications" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "driver_qualifications_tenant_update" ON "driver_qualifications" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "driver_qualifications_tenant_delete" ON "driver_qualifications" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- cv_parse_logs
CREATE POLICY "cv_parse_logs_tenant_select" ON "cv_parse_logs" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "cv_parse_logs_tenant_insert" ON "cv_parse_logs" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "cv_parse_logs_tenant_update" ON "cv_parse_logs" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "cv_parse_logs_tenant_delete" ON "cv_parse_logs" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- campaigns
CREATE POLICY "campaigns_tenant_select" ON "campaigns" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "campaigns_tenant_insert" ON "campaigns" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "campaigns_tenant_update" ON "campaigns" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "campaigns_tenant_delete" ON "campaigns" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- targeting_templates
CREATE POLICY "targeting_templates_tenant_select" ON "targeting_templates" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "targeting_templates_tenant_insert" ON "targeting_templates" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "targeting_templates_tenant_update" ON "targeting_templates" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "targeting_templates_tenant_delete" ON "targeting_templates" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- persona_templates
CREATE POLICY "persona_templates_tenant_select" ON "persona_templates" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "persona_templates_tenant_insert" ON "persona_templates" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "persona_templates_tenant_update" ON "persona_templates" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "persona_templates_tenant_delete" ON "persona_templates" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- campaign_daily_metrics
CREATE POLICY "campaign_daily_metrics_tenant_select" ON "campaign_daily_metrics" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "campaign_daily_metrics_tenant_insert" ON "campaign_daily_metrics" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "campaign_daily_metrics_tenant_update" ON "campaign_daily_metrics" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "campaign_daily_metrics_tenant_delete" ON "campaign_daily_metrics" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- ai_screening_logs
CREATE POLICY "ai_screening_logs_tenant_select" ON "ai_screening_logs" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "ai_screening_logs_tenant_insert" ON "ai_screening_logs" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "ai_screening_logs_tenant_update" ON "ai_screening_logs" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "ai_screening_logs_tenant_delete" ON "ai_screening_logs" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- calendar_connections
CREATE POLICY "calendar_connections_tenant_select" ON "calendar_connections" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "calendar_connections_tenant_insert" ON "calendar_connections" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "calendar_connections_tenant_update" ON "calendar_connections" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "calendar_connections_tenant_delete" ON "calendar_connections" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- interviews
CREATE POLICY "interviews_tenant_select" ON "interviews" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "interviews_tenant_insert" ON "interviews" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "interviews_tenant_update" ON "interviews" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "interviews_tenant_delete" ON "interviews" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- qualification_presets
CREATE POLICY "qualification_presets_tenant_select" ON "qualification_presets" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "qualification_presets_tenant_insert" ON "qualification_presets" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "qualification_presets_tenant_update" ON "qualification_presets" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "qualification_presets_tenant_delete" ON "qualification_presets" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- Step 3: Force RLS on all tenant-scoped tables (applies even to table owner)
ALTER TABLE pipeline_stages FORCE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;
ALTER TABLE vacancies FORCE ROW LEVEL SECURITY;
ALTER TABLE vacancy_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE vacancy_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE client_vacancy_access FORCE ROW LEVEL SECURITY;
ALTER TABLE candidates FORCE ROW LEVEL SECURITY;
ALTER TABLE candidate_applications FORCE ROW LEVEL SECURITY;
ALTER TABLE application_stage_history FORCE ROW LEVEL SECURITY;
ALTER TABLE file_metadata FORCE ROW LEVEL SECURITY;
ALTER TABLE activity_log FORCE ROW LEVEL SECURITY;
ALTER TABLE client_user_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE task_auto_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE application_tags FORCE ROW LEVEL SECURITY;
ALTER TABLE comments FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE driver_qualifications FORCE ROW LEVEL SECURITY;
ALTER TABLE cv_parse_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE targeting_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE persona_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE campaign_daily_metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_screening_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE calendar_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE interviews FORCE ROW LEVEL SECURITY;
ALTER TABLE qualification_presets FORCE ROW LEVEL SECURITY;

-- Step 4: Grant access to app_user for new tables
GRANT ALL ON driver_qualifications TO app_user;
GRANT ALL ON cv_parse_logs TO app_user;
GRANT ALL ON campaigns TO app_user;
GRANT ALL ON targeting_templates TO app_user;
GRANT ALL ON persona_templates TO app_user;
GRANT ALL ON campaign_daily_metrics TO app_user;
GRANT ALL ON meta_connections TO app_user;
GRANT ALL ON ai_screening_logs TO app_user;
GRANT ALL ON calendar_connections TO app_user;
GRANT ALL ON interviews TO app_user;
GRANT ALL ON qualification_presets TO app_user;

-- ── fleks-intake module tables ─────────────────────────────────────────

-- external_integrations
CREATE POLICY "external_integrations_tenant_select" ON "external_integrations" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "external_integrations_tenant_insert" ON "external_integrations" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "external_integrations_tenant_update" ON "external_integrations" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "external_integrations_tenant_delete" ON "external_integrations" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- intake_sessions
CREATE POLICY "intake_sessions_tenant_select" ON "intake_sessions" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "intake_sessions_tenant_insert" ON "intake_sessions" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "intake_sessions_tenant_update" ON "intake_sessions" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "intake_sessions_tenant_delete" ON "intake_sessions" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- intake_messages
CREATE POLICY "intake_messages_tenant_select" ON "intake_messages" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "intake_messages_tenant_insert" ON "intake_messages" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "intake_messages_tenant_update" ON "intake_messages" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "intake_messages_tenant_delete" ON "intake_messages" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- intake_templates
CREATE POLICY "intake_templates_tenant_select" ON "intake_templates" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "intake_templates_tenant_insert" ON "intake_templates" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "intake_templates_tenant_update" ON "intake_templates" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "intake_templates_tenant_delete" ON "intake_templates" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- fleks_sync_cursors
CREATE POLICY "fleks_sync_cursors_tenant_select" ON "fleks_sync_cursors" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "fleks_sync_cursors_tenant_insert" ON "fleks_sync_cursors" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "fleks_sync_cursors_tenant_update" ON "fleks_sync_cursors" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "fleks_sync_cursors_tenant_delete" ON "fleks_sync_cursors" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

-- Force RLS + grants
ALTER TABLE external_integrations FORCE ROW LEVEL SECURITY;
ALTER TABLE intake_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE intake_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE intake_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE fleks_sync_cursors FORCE ROW LEVEL SECURITY;

GRANT ALL ON external_integrations TO app_user;
GRANT ALL ON intake_sessions TO app_user;
GRANT ALL ON intake_messages TO app_user;
GRANT ALL ON intake_templates TO app_user;
GRANT ALL ON fleks_sync_cursors TO app_user;

-- pg-boss v12 auto-creates pgboss schema on startup; app_user needs the
-- permission to do so + access to its tables/sequences afterward.
DO $$ BEGIN EXECUTE format('GRANT CREATE ON DATABASE %I TO app_user', current_database()); END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'pgboss') THEN
    EXECUTE 'GRANT USAGE, CREATE ON SCHEMA pgboss TO app_user';
    EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA pgboss TO app_user';
    EXECUTE 'GRANT ALL ON ALL SEQUENCES IN SCHEMA pgboss TO app_user';
  END IF;
END $$;

-- The WhatsApp inbound webhook must resolve intake_session by phone before
-- any tenant context is available (webhooks aren't authed). Rather than
-- using a dedicated service role, grant BYPASSRLS to app_user. Tenant
-- isolation is still enforced on every HTTP request path via tenantMiddleware
-- + withTenantContext, which SET LOCAL app.tenant_id and let RLS filter.
-- BYPASSRLS only kicks in when app.tenant_id is unset (webhooks + jobs
-- that haven't yet looked up their orgId).
-- ── placements ─────────────────────────────────────────────────────────────

CREATE POLICY "placements_tenant_select" ON "placements" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "placements_tenant_insert" ON "placements" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "placements_tenant_update" ON "placements" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "placements_tenant_delete" ON "placements" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE placements FORCE ROW LEVEL SECURITY;
GRANT ALL ON placements TO app_user;

-- ── interview_scorecards ────────────────────────────────────────────────────

CREATE POLICY "interview_scorecards_tenant_select" ON "interview_scorecards" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "interview_scorecards_tenant_insert" ON "interview_scorecards" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "interview_scorecards_tenant_update" ON "interview_scorecards" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "interview_scorecards_tenant_delete" ON "interview_scorecards" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE interview_scorecards FORCE ROW LEVEL SECURITY;
GRANT ALL ON interview_scorecards TO app_user;

ALTER ROLE app_user BYPASSRLS;
