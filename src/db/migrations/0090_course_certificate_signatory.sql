ALTER TABLE "courses" ADD COLUMN "certificate_signer_name" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "certificate_signer_role" text;--> statement-breakpoint

WITH candidate_signatories AS (
  SELECT DISTINCT ON (template."course_id")
    template."course_id",
    NULLIF(BTRIM(template."signer_name"), '') AS signer_name,
    NULLIF(BTRIM(template."signer_role"), '') AS signer_role
  FROM "certificate_templates" AS template
  WHERE template."status" IN ('published', 'draft')
    AND (
      NULLIF(BTRIM(template."signer_name"), '') IS NOT NULL
      OR NULLIF(BTRIM(template."signer_role"), '') IS NOT NULL
    )
  ORDER BY
    template."course_id",
    CASE template."status" WHEN 'published' THEN 0 ELSE 1 END,
    template."version" DESC,
    template."id" DESC
)
UPDATE "courses" AS course
SET
  "certificate_signer_name" = candidate."signer_name",
  "certificate_signer_role" = candidate."signer_role"
FROM candidate_signatories AS candidate
WHERE candidate."course_id" = course."id";
