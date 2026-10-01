CREATE TYPE "public"."account_email_challenge_purpose" AS ENUM('change_email', 'purchase_verification', 'signup', 'verify_email');--> statement-breakpoint
CREATE TYPE "public"."pending_signup_status" AS ENUM('pending', 'completed', 'expired', 'superseded');--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.canonicalize_auth_email_identity(input_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  WITH normalized AS (
    SELECT lower(btrim(input_email)) AS email
  ), address_parts AS (
    SELECT
      email,
      split_part(email, '@', 1) AS local_part,
      split_part(email, '@', 2) AS domain
    FROM normalized
  )
  SELECT CASE
    WHEN domain IN ('gmail.com', 'googlemail.com') THEN
      regexp_replace(split_part(local_part, '+', 1), '\.', '', 'g') || '@gmail.com'
    WHEN domain IN (
      'fastmail.com', 'hotmail.com', 'icloud.com', 'live.com', 'mac.com',
      'me.com', 'outlook.com', 'proton.me', 'protonmail.com', 'yahoo.com',
      'zoho.com'
    ) THEN split_part(local_part, '+', 1) || '@' || domain
    ELSE email
  END
  FROM address_parts;
$$;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users
    GROUP BY public.canonicalize_auth_email_identity(email)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Canonical email collisions exist; resolve them before applying identity onboarding migration 0097.';
  END IF;
END;
$$;--> statement-breakpoint
CREATE TABLE "account_email_challenge_rate_limits" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_email_challenge_rate_limits_count_non_negative" CHECK ("account_email_challenge_rate_limits"."request_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "account_email_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" "account_email_challenge_purpose" NOT NULL,
	"user_id" text,
	"pending_signup_id" uuid,
	"order_id" uuid,
	"pending_email" text,
	"generation" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_email_challenges_generation_positive" CHECK ("account_email_challenges"."generation" > 0),
	CONSTRAINT "account_email_challenges_owner_consistent" CHECK (num_nonnulls("account_email_challenges"."user_id", "account_email_challenges"."pending_signup_id") = 1),
	CONSTRAINT "account_email_challenges_purpose_consistent" CHECK ((
        ("account_email_challenges"."purpose" = 'signup' and "account_email_challenges"."pending_signup_id" is not null and "account_email_challenges"."order_id" is null and "account_email_challenges"."pending_email" is null)
        or ("account_email_challenges"."purpose" = 'verify_email' and "account_email_challenges"."user_id" is not null and "account_email_challenges"."order_id" is null and "account_email_challenges"."pending_email" is null)
        or ("account_email_challenges"."purpose" = 'purchase_verification' and "account_email_challenges"."user_id" is not null and "account_email_challenges"."order_id" is not null and "account_email_challenges"."pending_email" is null)
        or ("account_email_challenges"."purpose" = 'change_email' and "account_email_challenges"."user_id" is not null and "account_email_challenges"."order_id" is null and "account_email_challenges"."pending_email" is not null)
      ))
);
--> statement-breakpoint
CREATE TABLE "pending_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"course_slug" text,
	"status" "pending_signup_status" DEFAULT 'pending' NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pending_signups_generation_positive" CHECK ("pending_signups"."generation" > 0),
	CONSTRAINT "pending_signups_course_slug_valid" CHECK ("pending_signups"."course_slug" is null or "pending_signups"."course_slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "account_email_challenges" ADD CONSTRAINT "account_email_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_email_challenges" ADD CONSTRAINT "account_email_challenges_pending_signup_id_pending_signups_id_fk" FOREIGN KEY ("pending_signup_id") REFERENCES "public"."pending_signups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_email_challenges" ADD CONSTRAINT "account_email_challenges_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_email_challenge_rate_limits_expires_at_idx" ON "account_email_challenge_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "account_email_challenges_pending_signup_purpose_unique_idx" ON "account_email_challenges" USING btree ("pending_signup_id","purpose") WHERE "account_email_challenges"."pending_signup_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "account_email_challenges_user_purpose_unique_idx" ON "account_email_challenges" USING btree ("user_id","purpose") WHERE "account_email_challenges"."user_id" is not null and "account_email_challenges"."order_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "account_email_challenges_order_unique_idx" ON "account_email_challenges" USING btree ("order_id") WHERE "account_email_challenges"."order_id" is not null;--> statement-breakpoint
CREATE INDEX "account_email_challenges_expires_at_idx" ON "account_email_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_signups_email_identity_pending_unique_idx" ON "pending_signups" USING btree (canonicalize_auth_email_identity("email")) WHERE "pending_signups"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "pending_signups_expires_at_idx" ON "pending_signups" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_identity_unique_idx" ON "users" USING btree (canonicalize_auth_email_identity("email"));
