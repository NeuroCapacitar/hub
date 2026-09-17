ALTER TABLE "profiles" ADD COLUMN "support_permission_grants" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
UPDATE "profiles"
SET "support_permission_grants" = ARRAY[
  'executeRefund',
  'manageEnrollmentSupport',
  'reissueCertificates'
]::text[]
WHERE "role" = 'support';--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_support_permission_grants_consistent" CHECK ((
        (
          "profiles"."role" = 'support'
          and "profiles"."support_permission_grants" <@ ARRAY[
            'executeRefund',
            'manageEnrollmentSupport',
            'reissueCertificates',
            'manageFinancialOperations',
            'manageFinancialReviews'
          ]::text[]
          and array_position("profiles"."support_permission_grants", NULL::text) is null
          and cardinality("profiles"."support_permission_grants") = (
            case when array_position("profiles"."support_permission_grants", 'executeRefund') is not null then 1 else 0 end
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
