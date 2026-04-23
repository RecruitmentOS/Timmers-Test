CREATE TABLE "interview_scorecards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"interview_id" uuid NOT NULL,
	"interviewer_id" text NOT NULL,
	"criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"overall_rating" integer NOT NULL,
	"recommendation" varchar(20) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "interview_scorecards_interview_id_unique" UNIQUE("interview_id")
);
--> statement-breakpoint
ALTER TABLE "interview_scorecards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interview_scorecards" ADD CONSTRAINT "interview_scorecards_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_scorecards" ADD CONSTRAINT "interview_scorecards_interviewer_id_user_id_fk" FOREIGN KEY ("interviewer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "interview_scorecards_tenant_select" ON "interview_scorecards" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "interview_scorecards_tenant_insert" ON "interview_scorecards" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "interview_scorecards_tenant_update" ON "interview_scorecards" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("organization_id" = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "interview_scorecards_tenant_delete" ON "interview_scorecards" AS PERMISSIVE FOR DELETE TO "app_user" USING ("organization_id" = current_setting('app.tenant_id')::uuid);