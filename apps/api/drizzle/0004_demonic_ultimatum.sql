CREATE INDEX "nilo_sessions_contact_phone_idx" ON "nilo_sessions" USING btree ("contact_phone");--> statement-breakpoint
CREATE INDEX "nilo_sessions_org_state_idx" ON "nilo_sessions" USING btree ("organization_id","state");--> statement-breakpoint
CREATE INDEX "nilo_messages_session_id_idx" ON "nilo_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "nilo_webhook_logs_session_id_idx" ON "nilo_webhook_logs" USING btree ("session_id");--> statement-breakpoint
ALTER TABLE "nilo_messages" ADD CONSTRAINT "nilo_messages_direction_check" CHECK ("nilo_messages"."direction" IN ('inbound', 'outbound'));