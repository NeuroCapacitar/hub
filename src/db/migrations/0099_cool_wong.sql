CREATE TYPE "public"."staff_invitation_status" AS ENUM('accepted', 'expired', 'pending', 'revoked');--> statement-breakpoint
ALTER TYPE "public"."email_delivery_topic" ADD VALUE 'auth.staff-invitation' BEFORE 'email.support-request';--> statement-breakpoint
ALTER TYPE "public"."email_template_alias" ADD VALUE 'staff-invitation' BEFORE 'support-request';--> statement-breakpoint
CREATE TABLE "staff_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" "role" NOT NULL,
	"support_permission_grants" text[] DEFAULT '{}'::text[] NOT NULL,
	"support_permission_views" text[] DEFAULT '{}'::text[] NOT NULL,
	"inviter_user_id" text,
	"reason" text NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"status" "staff_invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_user_id" text,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_invitations_generation_positive" CHECK ("staff_invitations"."generation" > 0),
	CONSTRAINT "staff_invitations_staff_role_only" CHECK ("staff_invitations"."role" in ('admin', 'support')),
	CONSTRAINT "staff_invitations_admin_has_no_support_permissions" CHECK ("staff_invitations"."role" <> 'admin' or (
        cardinality("staff_invitations"."support_permission_grants") = 0
        and cardinality("staff_invitations"."support_permission_views") = 0
      )),
	CONSTRAINT "staff_invitations_permissions_allowlisted" CHECK ("staff_invitations"."support_permission_grants" <@ ARRAY[
        'createCourse', 'manageCourseDetails', 'manageCourseContent',
        'manageCourseAvailability', 'manageCourseCertificate',
        'manageEnrollmentSupport', 'manageEnrollmentAccess',
        'reissueCertificates', 'manageCertificateIssuerProfile',
        'executeRefund', 'manageFinancialOperations', 'manageFinancialReviews',
        'manageOperations'
      ]::text[] and "staff_invitations"."support_permission_views" <@ ARRAY[
        'viewFinancialAnalysis', 'viewFinancialOrders',
        'viewFinancialReviews', 'viewAudit'
      ]::text[])
);
--> statement-breakpoint
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_invitations_pending_email_identity_unique_idx" ON "staff_invitations" USING btree (canonicalize_auth_email_identity("email")) WHERE "staff_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "staff_invitations_expires_at_idx" ON "staff_invitations" USING btree ("expires_at");