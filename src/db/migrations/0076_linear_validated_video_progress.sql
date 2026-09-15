CREATE TYPE "public"."lesson_completion_source" AS ENUM('manual', 'video');--> statement-breakpoint
ALTER TYPE "public"."learning_analytics_event_type" ADD VALUE 'watch_progress' BEFORE 'lesson_completed';--> statement-breakpoint
ALTER TABLE "learning_analytics_daily_metrics" ADD COLUMN "playing_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "learning_analytics_events" ADD COLUMN "playing_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD COLUMN "completion_source" "lesson_completion_source";--> statement-breakpoint
ALTER TABLE "lesson_watch_progress" ADD COLUMN "resume_position_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_watch_progress" ADD COLUMN "validated_position_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_watch_progress" ADD COLUMN "playing_time_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_watch_progress" ADD COLUMN "tracking_session_id" text;--> statement-breakpoint
ALTER TABLE "lesson_watch_progress" ADD COLUMN "last_event_sequence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_watch_progress" ADD COLUMN "awaiting_playback_after_seek" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_watch_progress" ADD COLUMN "linear_progress_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_watch_progress" ADD COLUMN "tracking_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "lesson_watch_progress"
SET "resume_position_seconds" = "current_seconds";--> statement-breakpoint
ALTER TABLE "learning_analytics_events" ADD CONSTRAINT "learning_analytics_events_playing_seconds_non_negative" CHECK ("learning_analytics_events"."playing_seconds" >= 0);--> statement-breakpoint
ALTER TABLE "lesson_watch_progress" ADD CONSTRAINT "lesson_watch_progress_resume_position_seconds_non_negative" CHECK ("lesson_watch_progress"."resume_position_seconds" >= 0);--> statement-breakpoint
ALTER TABLE "lesson_watch_progress" ADD CONSTRAINT "lesson_watch_progress_validated_position_seconds_non_negative" CHECK ("lesson_watch_progress"."validated_position_seconds" >= 0);--> statement-breakpoint
ALTER TABLE "lesson_watch_progress" ADD CONSTRAINT "lesson_watch_progress_playing_time_seconds_non_negative" CHECK ("lesson_watch_progress"."playing_time_seconds" >= 0);--> statement-breakpoint
ALTER TABLE "lesson_watch_progress" ADD CONSTRAINT "lesson_watch_progress_last_event_sequence_non_negative" CHECK ("lesson_watch_progress"."last_event_sequence" >= 0);--> statement-breakpoint
ALTER TABLE "lesson_watch_progress" ADD CONSTRAINT "lesson_watch_progress_tracking_version_valid" CHECK ("lesson_watch_progress"."tracking_version" in (0, 1));
