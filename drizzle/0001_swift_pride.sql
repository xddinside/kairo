DROP INDEX "focus_one_active_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "focus_one_active_idx" ON "focus_sessions" USING btree ("owner_id") WHERE "focus_sessions"."state" = 'active';