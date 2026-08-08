ALTER TABLE "canvas_activities" DROP CONSTRAINT "canvas_activities_canvas_id_canvases_id_fk";
--> statement-breakpoint
ALTER TABLE "canvas_operations" DROP CONSTRAINT "canvas_operations_canvas_id_canvases_id_fk";
--> statement-breakpoint
ALTER TABLE "file_chunks" DROP CONSTRAINT "file_chunks_file_id_files_id_fk";
--> statement-breakpoint
ALTER TABLE "file_processing_jobs" DROP CONSTRAINT "file_processing_jobs_file_id_files_id_fk";
--> statement-breakpoint
ALTER TABLE "generated_views" DROP CONSTRAINT "generated_views_canvas_id_canvases_id_fk";
--> statement-breakpoint
ALTER TABLE "notification_deliveries" DROP CONSTRAINT "notification_deliveries_event_id_notification_events_id_fk";
--> statement-breakpoint
ALTER TABLE "notification_deliveries" DROP CONSTRAINT "notification_deliveries_subscription_id_browser_subscriptions_id_fk";
--> statement-breakpoint
ALTER TABLE "canvas_activities" ADD CONSTRAINT "canvas_activity_owner_fk" FOREIGN KEY ("canvas_id","owner_id") REFERENCES "public"."canvases"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_operations" ADD CONSTRAINT "canvas_operation_owner_fk" FOREIGN KEY ("canvas_id","owner_id") REFERENCES "public"."canvases"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_file_owner_fk" FOREIGN KEY ("file_id","owner_id") REFERENCES "public"."files"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_processing_jobs" ADD CONSTRAINT "file_jobs_file_owner_fk" FOREIGN KEY ("file_id","owner_id") REFERENCES "public"."files"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_views" ADD CONSTRAINT "generated_view_owner_fk" FOREIGN KEY ("canvas_id","owner_id") REFERENCES "public"."canvases"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_delivery_event_owner_fk" FOREIGN KEY ("event_id","owner_id") REFERENCES "public"."notification_events"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_delivery_subscription_owner_fk" FOREIGN KEY ("subscription_id","owner_id") REFERENCES "public"."browser_subscriptions"("id","owner_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_due_time_requires_date_chk" CHECK ("due_time" IS NULL OR "due_date" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_due_time_requires_date_chk" CHECK ("due_time" IS NULL OR "due_date" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_version_positive_chk" CHECK ("version" > 0);--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_version_positive_chk" CHECK ("version" > 0);--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_version_positive_chk" CHECK ("version" > 0);--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_version_positive_chk" CHECK ("version" > 0);--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_version_positive_chk" CHECK ("version" > 0);--> statement-breakpoint
ALTER TABLE "canvases" ADD CONSTRAINT "canvas_version_positive_chk" CHECK ("version" > 0);--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_size_positive_chk" CHECK ("size_bytes" > 0);--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_version_positive_chk" CHECK ("version" > 0);--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_planned_seconds_positive_chk" CHECK ("planned_seconds" > 0);--> statement-breakpoint
ALTER TABLE "domain_commands" ADD CONSTRAINT "domain_command_version_positive_chk" CHECK ("command_version" > 0);--> statement-breakpoint
ALTER TABLE "undo_tokens" ADD CONSTRAINT "undo_expected_version_positive_chk" CHECK ("expected_version" > 0);--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_date_range_chk" CHECK ("start_date" <= "end_date");--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_time_range_chk" CHECK ("start_time" < "end_time");--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_expiry_after_schedule_chk" CHECK ("expires_at" > "scheduled_for");--> statement-breakpoint
ALTER TABLE "undo_tokens" ADD CONSTRAINT "undo_expiry_after_create_chk" CHECK ("expires_at" > "created_at");--> statement-breakpoint
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'courses', 'tasks', 'assessments', 'timetable_entries',
    'timetable_entry_exceptions', 'notes', 'files', 'file_chunks',
    'file_processing_jobs', 'canvases', 'canvas_activities', 'generated_views',
    'canvas_operations', 'focus_sessions', 'notification_preferences',
    'notification_events', 'browser_subscriptions', 'notification_deliveries',
    'domain_commands', 'undo_tokens', 'outbox_jobs', 'export_jobs', 'deletion_jobs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;--> statement-breakpoint
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'courses', 'tasks', 'assessments', 'timetable_entries',
    'timetable_entry_exceptions', 'notes', 'files', 'file_chunks',
    'file_processing_jobs', 'canvases', 'canvas_activities', 'generated_views',
    'canvas_operations', 'focus_sessions', 'notification_preferences',
    'notification_events', 'browser_subscriptions', 'notification_deliveries',
    'domain_commands', 'undo_tokens', 'outbox_jobs', 'export_jobs', 'deletion_jobs'
  ] LOOP
    EXECUTE format('CREATE POLICY kairo_owner_policy ON %I USING (owner_id = nullif(current_setting(''app.current_user_id'', true), '''')) WITH CHECK (owner_id = nullif(current_setting(''app.current_user_id'', true), ''''))', table_name);
  END LOOP;
  EXECUTE 'CREATE POLICY kairo_user_policy ON users USING (id = nullif(current_setting(''app.current_user_id'', true), '''')) WITH CHECK (id = nullif(current_setting(''app.current_user_id'', true), ''''))';
END $$;--> statement-breakpoint
COMMENT ON TABLE domain_commands IS 'Private, durable command results. Never expose args or inverse data to the browser without a typed service projection.';--> statement-breakpoint
COMMENT ON TABLE undo_tokens IS 'Private server-held inverse. The token presented by a client is hashed before lookup and is one-use.';--> statement-breakpoint
