ALTER TABLE "lesson_comments" ADD COLUMN "course_id" uuid;--> statement-breakpoint
ALTER TABLE "lesson_comments" ADD COLUMN "curriculum_key" uuid;--> statement-breakpoint
UPDATE "lesson_comments" AS lc
SET
  "course_id" = m."course_id",
  "curriculum_key" = l."curriculum_key"
FROM "lessons" AS l
INNER JOIN "modules" AS m ON m."id" = l."module_id"
WHERE lc."lesson_id" = l."id";--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "lesson_comments"
    WHERE "course_id" IS NULL OR "curriculum_key" IS NULL
  ) THEN
    RAISE EXCEPTION 'lesson_comments identity backfill left null values';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "lesson_comments" ALTER COLUMN "course_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_comments" ALTER COLUMN "curriculum_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_comments" ADD CONSTRAINT "lesson_comments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_comments_discussion_created_idx" ON "lesson_comments" USING btree ("course_id","curriculum_key","created_at","id");
