DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'support_mode'
  ) THEN
    DROP TRIGGER IF EXISTS "profiles_revoke_sessions_after_role_change"
      ON "profiles";
    ALTER TABLE "profiles"
      DROP CONSTRAINT IF EXISTS "profiles_role_support_mode_consistent";
    ALTER TABLE "profiles" DROP COLUMN "support_mode";

    IF to_regprocedure('public.revoke_sessions_after_profile_role_change()')
      IS NOT NULL THEN
      CREATE TRIGGER "profiles_revoke_sessions_after_role_change"
      AFTER UPDATE OF "role" ON "profiles"
      FOR EACH ROW
      WHEN (OLD."role" IS DISTINCT FROM NEW."role")
      EXECUTE FUNCTION "public"."revoke_sessions_after_profile_role_change"();
    END IF;
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lesson_comments'
      AND column_name = 'course_id'
  ) THEN
    ALTER TABLE "lesson_comments" ADD COLUMN "course_id" uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lesson_comments'
      AND column_name = 'curriculum_key'
  ) THEN
    ALTER TABLE "lesson_comments" ADD COLUMN "curriculum_key" uuid;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lesson_comments'
      AND column_name = 'lesson_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lesson_comments'
      AND column_name = 'source_lesson_id'
  ) THEN
    ALTER TABLE "lesson_comments" RENAME COLUMN "lesson_id" TO "source_lesson_id";
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lesson_comments'
      AND column_name = 'source_lesson_id'
  ) THEN
    RAISE EXCEPTION 'lesson_comments has no physical lesson source column';
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "lesson_comments" ALTER COLUMN "source_lesson_id" DROP NOT NULL;--> statement-breakpoint

UPDATE "lesson_comments" AS lc
SET
  "course_id" = m."course_id",
  "curriculum_key" = l."curriculum_key"
FROM "lessons" AS l
INNER JOIN "modules" AS m ON m."id" = l."module_id"
WHERE lc."source_lesson_id" = l."id"
  AND (lc."course_id" IS NULL OR lc."curriculum_key" IS NULL);--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "lesson_comments"
    WHERE "course_id" IS NULL OR "curriculum_key" IS NULL
  ) THEN
    RAISE EXCEPTION 'lesson_comments identity reconciliation left null values';
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "lesson_comments" ALTER COLUMN "course_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_comments" ALTER COLUMN "curriculum_key" SET NOT NULL;--> statement-breakpoint

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT c.conname
    FROM pg_constraint AS c
    INNER JOIN pg_attribute AS a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.lesson_comments'::regclass
      AND c.contype = 'f'
      AND a.attname = 'course_id'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.lesson_comments DROP CONSTRAINT %I',
      constraint_record.conname
    );
  END LOOP;

  FOR constraint_record IN
    SELECT c.conname
    FROM pg_constraint AS c
    INNER JOIN pg_attribute AS a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.lesson_comments'::regclass
      AND c.contype = 'f'
      AND a.attname = 'source_lesson_id'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.lesson_comments DROP CONSTRAINT %I',
      constraint_record.conname
    );
  END LOOP;
END $$;--> statement-breakpoint

ALTER TABLE "lesson_comments"
  ADD CONSTRAINT "lesson_comments_course_id_courses_id_fk"
  FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_comments"
  ADD CONSTRAINT "lesson_comments_source_lesson_id_lessons_id_fk"
  FOREIGN KEY ("source_lesson_id") REFERENCES "public"."lessons"("id")
  ON DELETE set null ON UPDATE no action;--> statement-breakpoint

DROP INDEX IF EXISTS "lesson_comments_lesson_created_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_comments_discussion_created_idx"
  ON "lesson_comments" USING btree ("course_id", "curriculum_key", "created_at", "id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_comments_source_lesson_created_idx"
  ON "lesson_comments" USING btree ("source_lesson_id", "created_at");
