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
