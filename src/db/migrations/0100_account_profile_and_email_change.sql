CREATE TYPE "public"."account_email_change_status" AS ENUM('cancelled', 'completed', 'expired', 'pending_current', 'pending_new');--> statement-breakpoint
CREATE TYPE "public"."profile_avatar_mode" AS ENUM('custom', 'google', 'initials');--> statement-breakpoint
ALTER TYPE "public"."email_delivery_topic" ADD VALUE 'auth.email-change-confirmation' BEFORE 'auth.email-verification';--> statement-breakpoint
ALTER TYPE "public"."email_delivery_topic" ADD VALUE 'email.email-change-notice' BEFORE 'auth.staff-invitation';--> statement-breakpoint
ALTER TYPE "public"."email_template_alias" ADD VALUE 'email-change-confirmation' BEFORE 'staff-invitation';--> statement-breakpoint
ALTER TYPE "public"."email_template_alias" ADD VALUE 'email-change-notice' BEFORE 'staff-invitation';--> statement-breakpoint
CREATE TABLE "account_email_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"current_email" text NOT NULL,
	"new_email" text NOT NULL,
	"status" "account_email_change_status" DEFAULT 'pending_current' NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"current_confirmed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_email_change_requests_generation_positive" CHECK ("account_email_change_requests"."generation" > 0),
	CONSTRAINT "account_email_change_requests_distinct_emails" CHECK (public.canonicalize_auth_email_identity("account_email_change_requests"."current_email")
        <> public.canonicalize_auth_email_identity("account_email_change_requests"."new_email"))
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "avatar_mode" "profile_avatar_mode" DEFAULT 'google' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "avatar_key" text;--> statement-breakpoint
ALTER TABLE "account_email_change_requests" ADD CONSTRAINT "account_email_change_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_email_change_requests_user_pending_unique_idx" ON "account_email_change_requests" USING btree ("user_id") WHERE "account_email_change_requests"."status" in ('pending_current', 'pending_new');--> statement-breakpoint
CREATE UNIQUE INDEX "account_email_change_requests_new_email_pending_unique_idx" ON "account_email_change_requests" USING btree (canonicalize_auth_email_identity("new_email")) WHERE "account_email_change_requests"."status" in ('pending_current', 'pending_new');--> statement-breakpoint
CREATE INDEX "account_email_change_requests_expires_at_idx" ON "account_email_change_requests" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatar_key_consistent" CHECK ((
        ("profiles"."avatar_mode" = 'custom' and "profiles"."avatar_key" is not null)
        or ("profiles"."avatar_mode" <> 'custom' and "profiles"."avatar_key" is null)
      ));