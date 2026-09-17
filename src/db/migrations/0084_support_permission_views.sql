ALTER TABLE "profiles" DROP CONSTRAINT "profiles_support_permission_grants_consistent";--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "support_permission_views" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
UPDATE "profiles"
SET "support_permission_views" = ARRAY[
  'viewAdminPanel',
  'viewLearningAnalytics',
  'viewCourses',
  'viewStudents',
  'viewFinancials',
  'viewOperations',
  'viewAudit',
  'viewSettings'
]::text[]
WHERE "role" = 'support';--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_support_permission_views_consistent" CHECK ((
        (
          "profiles"."role" = 'support'
          and "profiles"."support_permission_views" <@ ARRAY[
            'viewAdminPanel',
            'viewLearningAnalytics',
            'viewCourses',
            'viewStudents',
            'viewFinancials',
            'viewOperations',
            'viewAudit',
            'viewSettings'
          ]::text[]
          and array_position("profiles"."support_permission_views", NULL::text) is null
          and cardinality("profiles"."support_permission_views") = (
            case when array_position("profiles"."support_permission_views", 'viewAdminPanel') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_views", 'viewLearningAnalytics') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_views", 'viewCourses') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_views", 'viewStudents') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_views", 'viewFinancials') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_views", 'viewOperations') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_views", 'viewAudit') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_views", 'viewSettings') is not null then 1 else 0 end
          )
        )
        or (
          "profiles"."role" <> 'support'
          and cardinality("profiles"."support_permission_views") = 0
        )
      ));--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_support_permission_grants_consistent" CHECK ((
        (
          "profiles"."role" = 'support'
          and "profiles"."support_permission_grants" <@ ARRAY[
            'executeRefund',
            'exportLearningAnalytics',
            'manageCourses',
            'manageEnrollmentSupport',
            'reissueCertificates',
            'manageFinancialOperations',
            'manageFinancialReviews'
          ]::text[]
          and array_position("profiles"."support_permission_grants", NULL::text) is null
          and cardinality("profiles"."support_permission_grants") = (
            case when array_position("profiles"."support_permission_grants", 'executeRefund') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'exportLearningAnalytics') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'manageCourses') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'manageEnrollmentSupport') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'reissueCertificates') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'manageFinancialOperations') is not null then 1 else 0 end
            + case when array_position("profiles"."support_permission_grants", 'manageFinancialReviews') is not null then 1 else 0 end
          )
        )
        or (
          "profiles"."role" <> 'support'
          and cardinality("profiles"."support_permission_grants") = 0
        )
      ));
