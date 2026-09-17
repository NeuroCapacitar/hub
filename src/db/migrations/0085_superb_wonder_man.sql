ALTER TABLE "profiles" DROP CONSTRAINT "profiles_support_permission_grants_consistent";--> statement-breakpoint
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_support_permission_views_consistent";--> statement-breakpoint
UPDATE "profiles"
SET
  "support_permission_grants" = '{}'::text[],
  "support_permission_views" = '{}'::text[]
WHERE "role" = 'support';--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_support_permission_grants_consistent" CHECK ((
        (
          "profiles"."role" = 'support'
          and "profiles"."support_permission_grants" <@ ARRAY[
            'createCourse',
            'manageCourseDetails',
            'manageCourseContent',
            'manageCourseAvailability',
            'manageCourseCertificate',
            'manageEnrollmentSupport',
            'manageEnrollmentAccess',
            'reissueCertificates',
            'manageCertificateIssuerProfile',
            'executeRefund',
            'manageFinancialOperations',
            'manageFinancialReviews',
            'manageOperations'
          ]::text[]
          and array_position("profiles"."support_permission_grants", NULL::text) is null
          and cardinality("profiles"."support_permission_grants") = (
            case when array_position("profiles"."support_permission_grants", 'createCourse') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'manageCourseDetails') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'manageCourseContent') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'manageCourseAvailability') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'manageCourseCertificate') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'manageEnrollmentSupport') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'manageEnrollmentAccess') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'reissueCertificates') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'manageCertificateIssuerProfile') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'executeRefund') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'manageFinancialOperations') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'manageFinancialReviews') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'manageOperations') is not null then 1 else 0 end
          )
        )
        or (
          "profiles"."role" <> 'support'
          and cardinality("profiles"."support_permission_grants") = 0
        )
      ));--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_support_permission_views_consistent" CHECK ((
        (
          "profiles"."role" = 'support'
          and "profiles"."support_permission_views" <@ ARRAY[
            'viewFinancialAnalysis',
            'viewFinancialOrders',
            'viewFinancialReviews',
            'viewAudit'
          ]::text[]
          and array_position("profiles"."support_permission_views", NULL::text) is null
          and cardinality("profiles"."support_permission_views") = (
            case when array_position("profiles"."support_permission_views", 'viewFinancialAnalysis') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_views", 'viewFinancialOrders') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_views", 'viewFinancialReviews') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_views", 'viewAudit') is not null then 1 else 0 end
          )
        )
        or (
          "profiles"."role" <> 'support'
          and cardinality("profiles"."support_permission_views") = 0
        )
      ));
