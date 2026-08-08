CREATE TYPE "public"."academic_status" AS ENUM('open', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."canvas_state" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."command_state" AS ENUM('applied', 'already_applied', 'conflict', 'not_found', 'invalid', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."delivery_state" AS ENUM('pending', 'leased', 'shown', 'accepted', 'clicked', 'closed', 'retrying', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."file_extraction_state" AS ENUM('pending', 'ready', 'truncated', 'empty', 'failed');--> statement-breakpoint
CREATE TYPE "public"."file_kind" AS ENUM('markdown', 'pdf');--> statement-breakpoint
CREATE TYPE "public"."file_lifecycle_state" AS ENUM('pending_upload', 'processing', 'ready', 'failed', 'rejected', 'deleting');--> statement-breakpoint
CREATE TYPE "public"."focus_state" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'browser');--> statement-breakpoint
CREATE TYPE "public"."notification_event_state" AS ENUM('pending', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('deadline', 'timetable', 'focus_completion');--> statement-breakpoint
CREATE TYPE "public"."operation_state" AS ENUM('queued', 'running', 'ready', 'failed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."timetable_kind" AS ENUM('one_off', 'weekly');--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" varchar(200) NOT NULL,
	"details" text,
	"course_id" uuid,
	"due_date" date,
	"due_time" time(0),
	"status" "academic_status" DEFAULT 'open' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"purge_after" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "browser_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"endpoint_hash" varchar(128) NOT NULL,
	"encrypted_endpoint" text NOT NULL,
	"encrypted_keys" text NOT NULL,
	"expires_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"canvas_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"kind" varchar(32) NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"canvas_id" uuid NOT NULL,
	"client_request_id" varchar(200) NOT NULL,
	"state" "operation_state" DEFAULT 'queued' NOT NULL,
	"payload" jsonb NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" varchar(160),
	"state" "canvas_state" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"purge_after" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" varchar(200) NOT NULL,
	"code" varchar(64),
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"purge_after" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deletion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"object_key_hash" varchar(128) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"failure_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"canvas_id" uuid,
	"source_activity_id" uuid,
	"idempotency_key" varchar(200) NOT NULL,
	"command_version" integer NOT NULL,
	"kind" varchar(96) NOT NULL,
	"target_type" varchar(64),
	"target_id" uuid,
	"expected_version" integer,
	"state" "command_state" NOT NULL,
	"args" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"error_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"include_structured_data" boolean NOT NULL,
	"include_notes" boolean NOT NULL,
	"include_files" boolean NOT NULL,
	"state" "operation_state" DEFAULT 'queued' NOT NULL,
	"archive_key" text,
	"failure_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "file_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"locator" jsonb NOT NULL,
	"text" text NOT NULL,
	"character_count" integer NOT NULL,
	"extraction_version" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_processing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"file_id" uuid NOT NULL,
	"expected_version" integer NOT NULL,
	"kind" varchar(32) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"failure_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"course_id" uuid,
	"kind" "file_kind" NOT NULL,
	"display_name" varchar(180) NOT NULL,
	"content_type" varchar(96) NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" varchar(128),
	"storage_provider" varchar(32) NOT NULL,
	"storage_bucket_alias" varchar(128) NOT NULL,
	"storage_key" text NOT NULL,
	"object_etag" text,
	"lifecycle_state" "file_lifecycle_state" DEFAULT 'pending_upload' NOT NULL,
	"extraction_state" "file_extraction_state" DEFAULT 'pending' NOT NULL,
	"extraction_version" varchar(64),
	"page_count" integer,
	"extracted_chars" integer DEFAULT 0 NOT NULL,
	"failure_code" varchar(64),
	"failure_attempt" integer DEFAULT 0 NOT NULL,
	"upload_expires_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "focus_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"task_id" uuid,
	"course_id" uuid,
	"canvas_id" uuid,
	"state" "focus_state" NOT NULL,
	"planned_seconds" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"canvas_id" uuid NOT NULL,
	"request_activity_id" uuid,
	"history_sequence" integer NOT NULL,
	"catalog_version" varchar(64) NOT NULL,
	"schema_version" varchar(64) NOT NULL,
	"model_version" varchar(128) NOT NULL,
	"prompt_version" varchar(64) NOT NULL,
	"spec" jsonb NOT NULL,
	"rationale" varchar(600),
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" varchar(160) NOT NULL,
	"body_markdown" text DEFAULT '' NOT NULL,
	"course_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"purge_after" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"subscription_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"delivery_key" varchar(512) NOT NULL,
	"state" "delivery_state" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"event_key" varchar(512) NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"source_type" varchar(32) NOT NULL,
	"source_id" uuid NOT NULL,
	"occurrence_key" varchar(128),
	"scheduled_for" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"source_time_zone" varchar(128) NOT NULL,
	"rule_version" integer NOT NULL,
	"state" "notification_event_state" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"in_app_deadlines" boolean DEFAULT true NOT NULL,
	"in_app_timetable" boolean DEFAULT true NOT NULL,
	"in_app_focus_completion" boolean DEFAULT true NOT NULL,
	"browser_enabled" boolean DEFAULT false NOT NULL,
	"browser_deadlines" boolean DEFAULT true NOT NULL,
	"browser_timetable" boolean DEFAULT true NOT NULL,
	"browser_focus_completion" boolean DEFAULT true NOT NULL,
	"quiet_start" time(0) DEFAULT '22:00' NOT NULL,
	"quiet_end" time(0) DEFAULT '07:00' NOT NULL,
	"body_mode" varchar(16) DEFAULT 'generic' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"kind" varchar(64) NOT NULL,
	"aggregate_type" varchar(64) NOT NULL,
	"aggregate_id" uuid,
	"payload" jsonb NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" varchar(200) NOT NULL,
	"details" text,
	"course_id" uuid,
	"assessment_id" uuid,
	"due_date" date,
	"due_time" time(0),
	"status" "academic_status" DEFAULT 'open' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"purge_after" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "timetable_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" varchar(160) NOT NULL,
	"details" text,
	"course_id" uuid,
	"kind" timetable_kind NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days_of_week" integer[] DEFAULT '{}' NOT NULL,
	"start_time" time(0) NOT NULL,
	"end_time" time(0) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"purge_after" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "timetable_entry_exceptions" (
	"entry_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"occurrence_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "timetable_entry_exceptions_entry_id_occurrence_date_pk" PRIMARY KEY("entry_id","occurrence_date")
);
--> statement-breakpoint
CREATE TABLE "undo_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"command_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"inverse" jsonb NOT NULL,
	"expected_version" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"time_zone" varchar(128) DEFAULT 'UTC' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_id_owner_unique" UNIQUE ("id", "owner_id");--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_id_owner_unique" UNIQUE ("id", "owner_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_id_owner_unique" UNIQUE ("id", "owner_id");--> statement-breakpoint
ALTER TABLE "canvases" ADD CONSTRAINT "canvases_id_owner_unique" UNIQUE ("id", "owner_id");--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_id_owner_unique" UNIQUE ("id", "owner_id");--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_id_owner_unique" UNIQUE ("id", "owner_id");--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_id_owner_unique" UNIQUE ("id", "owner_id");--> statement-breakpoint
ALTER TABLE "browser_subscriptions" ADD CONSTRAINT "browser_subscriptions_id_owner_unique" UNIQUE ("id", "owner_id");--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_owner_fk" FOREIGN KEY ("course_id","owner_id") REFERENCES "public"."courses"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_subscriptions" ADD CONSTRAINT "browser_subscriptions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_activities" ADD CONSTRAINT "canvas_activities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_activities" ADD CONSTRAINT "canvas_activities_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_operations" ADD CONSTRAINT "canvas_operations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_operations" ADD CONSTRAINT "canvas_operations_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvases" ADD CONSTRAINT "canvases_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deletion_jobs" ADD CONSTRAINT "deletion_jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_commands" ADD CONSTRAINT "domain_commands_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_commands" ADD CONSTRAINT "domain_commands_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_processing_jobs" ADD CONSTRAINT "file_processing_jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_processing_jobs" ADD CONSTRAINT "file_processing_jobs_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_course_owner_fk" FOREIGN KEY ("course_id","owner_id") REFERENCES "public"."courses"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_task_owner_fk" FOREIGN KEY ("task_id","owner_id") REFERENCES "public"."tasks"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_course_owner_fk" FOREIGN KEY ("course_id","owner_id") REFERENCES "public"."courses"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_canvas_owner_fk" FOREIGN KEY ("canvas_id","owner_id") REFERENCES "public"."canvases"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_views" ADD CONSTRAINT "generated_views_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_views" ADD CONSTRAINT "generated_views_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_course_owner_fk" FOREIGN KEY ("course_id","owner_id") REFERENCES "public"."courses"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_event_id_notification_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."notification_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_subscription_id_browser_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."browser_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_jobs" ADD CONSTRAINT "outbox_jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_course_owner_fk" FOREIGN KEY ("course_id","owner_id") REFERENCES "public"."courses"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assessment_owner_fk" FOREIGN KEY ("assessment_id","owner_id") REFERENCES "public"."assessments"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_course_owner_fk" FOREIGN KEY ("course_id","owner_id") REFERENCES "public"."courses"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_entry_exceptions" ADD CONSTRAINT "timetable_exception_owner_fk" FOREIGN KEY ("entry_id","owner_id") REFERENCES "public"."timetable_entries"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "undo_tokens" ADD CONSTRAINT "undo_tokens_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "undo_tokens" ADD CONSTRAINT "undo_tokens_command_id_domain_commands_id_fk" FOREIGN KEY ("command_id") REFERENCES "public"."domain_commands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessments_owner_due_idx" ON "assessments" USING btree ("owner_id","due_date","id") WHERE "assessments"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "browser_subscriptions_owner_endpoint_idx" ON "browser_subscriptions" USING btree ("owner_id","endpoint_hash");--> statement-breakpoint
CREATE INDEX "browser_subscriptions_owner_live_idx" ON "browser_subscriptions" USING btree ("owner_id") WHERE "browser_subscriptions"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "canvas_activities_sequence_idx" ON "canvas_activities" USING btree ("canvas_id","sequence");--> statement-breakpoint
CREATE INDEX "canvas_activities_owner_idx" ON "canvas_activities" USING btree ("owner_id","canvas_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "canvas_operations_owner_request_idx" ON "canvas_operations" USING btree ("owner_id","client_request_id");--> statement-breakpoint
CREATE INDEX "canvas_operations_canvas_idx" ON "canvas_operations" USING btree ("canvas_id","created_at");--> statement-breakpoint
CREATE INDEX "canvases_owner_updated_idx" ON "canvases" USING btree ("owner_id","updated_at","id") WHERE "canvases"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "courses_owner_live_idx" ON "courses" USING btree ("owner_id","updated_at") WHERE "courses"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "courses_owner_title_idx" ON "courses" USING btree ("owner_id","title") WHERE "courses"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "deletion_jobs_available_idx" ON "deletion_jobs" USING btree ("available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "domain_commands_owner_idempotency_idx" ON "domain_commands" USING btree ("owner_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "domain_commands_owner_created_idx" ON "domain_commands" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "domain_commands_target_idx" ON "domain_commands" USING btree ("owner_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "export_jobs_owner_idx" ON "export_jobs" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "file_chunks_file_ordinal_idx" ON "file_chunks" USING btree ("file_id","ordinal");--> statement-breakpoint
CREATE INDEX "file_chunks_owner_idx" ON "file_chunks" USING btree ("owner_id","file_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "file_jobs_file_version_kind_idx" ON "file_processing_jobs" USING btree ("file_id","expected_version","kind");--> statement-breakpoint
CREATE INDEX "file_jobs_owner_available_idx" ON "file_processing_jobs" USING btree ("owner_id","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "files_owner_storage_key_idx" ON "files" USING btree ("owner_id","storage_key");--> statement-breakpoint
CREATE INDEX "files_owner_state_idx" ON "files" USING btree ("owner_id","lifecycle_state","id");--> statement-breakpoint
CREATE UNIQUE INDEX "focus_one_active_idx" ON "focus_sessions" USING btree ("owner_id") WHERE "focus_sessions"."state" = 'active';--> statement-breakpoint
CREATE INDEX "focus_owner_history_idx" ON "focus_sessions" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "generated_views_history_idx" ON "generated_views" USING btree ("canvas_id","history_sequence");--> statement-breakpoint
CREATE INDEX "generated_views_owner_idx" ON "generated_views" USING btree ("owner_id","canvas_id","history_sequence");--> statement-breakpoint
CREATE INDEX "notes_owner_updated_idx" ON "notes" USING btree ("owner_id","updated_at","id") WHERE "notes"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_delivery_key_idx" ON "notification_deliveries" USING btree ("owner_id","delivery_key");--> statement-breakpoint
CREATE INDEX "notification_delivery_due_idx" ON "notification_deliveries" USING btree ("owner_id","state","lease_until");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_events_owner_key_idx" ON "notification_events" USING btree ("owner_id","event_key");--> statement-breakpoint
CREATE INDEX "notification_events_due_idx" ON "notification_events" USING btree ("owner_id","state","scheduled_for");--> statement-breakpoint
CREATE INDEX "outbox_available_idx" ON "outbox_jobs" USING btree ("available_at","lease_until");--> statement-breakpoint
CREATE INDEX "tasks_owner_due_idx" ON "tasks" USING btree ("owner_id","due_date","id") WHERE "tasks"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "tasks_assessment_idx" ON "tasks" USING btree ("owner_id","assessment_id") WHERE "tasks"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "timetable_owner_date_idx" ON "timetable_entries" USING btree ("owner_id","start_date","id") WHERE "timetable_entries"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "timetable_exceptions_owner_idx" ON "timetable_entry_exceptions" USING btree ("owner_id","entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "undo_token_hash_idx" ON "undo_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "undo_owner_expiry_idx" ON "undo_tokens" USING btree ("owner_id","expires_at");--> statement-breakpoint
CREATE INDEX "users_live_idx" ON "users" USING btree ("id") WHERE "users"."deleted_at" is null;
