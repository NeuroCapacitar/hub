ALTER TABLE "lesson_comments" DROP CONSTRAINT "lesson_comments_lesson_id_fkey";--> statement-breakpoint
ALTER TABLE "lesson_comments" RENAME COLUMN "lesson_id" TO "source_lesson_id";--> statement-breakpoint
ALTER TABLE "lesson_comments" ALTER COLUMN "source_lesson_id" DROP NOT NULL;--> statement-breakpoint
DROP INDEX "lesson_comments_lesson_created_idx";--> statement-breakpoint
ALTER TABLE "lesson_comments" ADD CONSTRAINT "lesson_comments_source_lesson_id_lessons_id_fk" FOREIGN KEY ("source_lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_comments_source_lesson_created_idx" ON "lesson_comments" USING btree ("source_lesson_id","created_at");
