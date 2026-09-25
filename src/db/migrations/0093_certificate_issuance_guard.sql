ALTER TABLE "course_completions" ADD COLUMN "certificate_ever_issued" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "certificates" certificate
    LEFT JOIN "course_completions" completion
      ON completion."user_id" = certificate."user_id"
     AND completion."course_id" = certificate."course_id"
    WHERE completion."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot backfill certificate issuance guard: a certificate has no matching course completion.';
  END IF;
END $$;
--> statement-breakpoint
UPDATE "course_completions" completion
SET "certificate_ever_issued" = true
WHERE EXISTS (
  SELECT 1
  FROM "certificates" certificate
  WHERE certificate."user_id" = completion."user_id"
    AND certificate."course_id" = completion."course_id"
);
