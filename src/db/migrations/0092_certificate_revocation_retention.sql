CREATE TABLE "certificate_revocation_tombstones" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"revoked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "certificate_revocation_tombstones_code_hash_check" CHECK ("certificate_revocation_tombstones"."code_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_pdf_purged_state_check";--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_pdf_purged_state_check" CHECK ("certificates"."pdf_purged_at" is null or ("certificates"."status" = 'revoked' and "certificates"."pdf_storage_key" is null and "certificates"."pdf_sha256" is null and "certificates"."render_claim_token" is null));