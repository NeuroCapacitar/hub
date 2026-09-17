export interface MigrationStateCheck {
  check: string;
  migration: string;
  statement: string;
}

export const courseContentMigrationStateChecks: readonly MigrationStateCheck[] =
  [
    {
      check: "ownership relacional de Modulo e Publicacao",
      migration: "0078_protect_module_course_publication_ownership",
      statement:
        "select exists (select 1 from pg_constraint where conrelid = 'public.course_publications'::regclass and conname = 'course_publications_id_course_unique' and contype = 'u' and convalidated) and exists (select 1 from pg_constraint where conrelid = 'public.modules'::regclass and conname = 'modules_course_publication_course_fk' and contype = 'f' and convalidated) as present",
    },
    {
      check: "ownership relacional de Aula, Modulo e Publicacao",
      migration: "0079_protect_lesson_module_publication_ownership",
      statement:
        "select exists (select 1 from pg_constraint where conrelid = 'public.modules'::regclass and conname = 'modules_id_course_publication_unique' and contype = 'u' and convalidated) and exists (select 1 from pg_constraint where conrelid = 'public.lessons'::regclass and conname = 'lessons_module_course_publication_fk' and contype = 'f' and convalidated) as present",
    },
  ];

export const certificateMigrationStateChecks: readonly MigrationStateCheck[] = [
  {
    check: "templates e artefatos imutaveis de certificados",
    migration: "0037_certificate_templates",
    statement:
      "select to_regclass('public.certificate_issuer_profiles') is not null and to_regclass('public.certificate_templates') is not null and to_regtype('public.certificate_render_status') is not null and to_regtype('public.certificate_template_status') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'courses' and column_name = 'certificate_enabled') and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'certificates' and column_name in ('certificate_template_id', 'pdf_storage_key', 'pdf_sha256', 'rendered_at', 'render_status', 'render_snapshot') having count(*) = 6) and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'certificates' and column_name = 'pdf_url') and to_regclass('public.certificate_templates_one_published_per_course_idx') is not null as present",
  },
  {
    check: "claim persistido e invariantes do artefato de certificado",
    migration: "0040_certificate_render_claim",
    statement:
      "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'certificates' and column_name in ('render_claim_token', 'render_claimed_at') having count(*) = 2) and exists (select 1 from pg_constraint where conrelid = 'public.certificates'::regclass and conname = 'certificates_render_claim_pair_check' and contype = 'c') and exists (select 1 from pg_constraint where conrelid = 'public.certificates'::regclass and conname = 'certificates_ready_artifact_check' and contype = 'c') as present",
  },
  {
    check: "estado de revogacao e historico de certificados",
    migration: "0056_certificate_state_invariants",
    statement:
      "select exists (select 1 from pg_constraint where conrelid = 'public.certificates'::regclass and conname in ('certificates_revocation_state_check', 'certificates_revoked_reason_category_check', 'certificates_valid_revocation_fields_check') and contype = 'c' group by conrelid having count(*) = 3) and exists (select 1 from pg_constraint where conrelid = 'public.certificates'::regclass and conname = 'certificates_course_id_courses_id_fk' and confdeltype = 'r') as present",
  },
];

export const supportPermissionMigrationStateChecks: readonly MigrationStateCheck[] =
  [
    {
      check: "grants individuais de Suporte",
      migration: "0083_support_permission_grants",
      statement:
        "select case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'support_permission_grants') and exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_support_permission_grants_consistent' and contype = 'c' and convalidated) then not exists (select 1 from profiles where (role = 'support' and to_jsonb(profiles) -> 'support_permission_grants' is null) or (role <> 'support' and case when jsonb_typeof(to_jsonb(profiles) -> 'support_permission_grants') = 'array' then jsonb_array_length(to_jsonb(profiles) -> 'support_permission_grants') else -1 end <> 0)) else false end as present",
    },
  ];

export const supportPermissionViewsMigrationStateChecks: readonly MigrationStateCheck[] =
  [
    {
      check: "visualizações individuais de Suporte",
      migration: "0084_support_permission_views",
      statement:
        "select case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'support_permission_views') and exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_support_permission_views_consistent' and contype = 'c' and convalidated) then not exists (select 1 from profiles where (role = 'support' and to_jsonb(profiles) -> 'support_permission_views' is null) or (role <> 'support' and case when jsonb_typeof(to_jsonb(profiles) -> 'support_permission_views') = 'array' then jsonb_array_length(to_jsonb(profiles) -> 'support_permission_views') else -1 end <> 0)) else false end as present",
    },
  ];

export const supportPermissionRefinementMigrationStateChecks: readonly MigrationStateCheck[] =
  [
    {
      check: "allowlist refinada e grants configuráveis limpos",
      migration: "0085_superb_wonder_man",
      statement:
        "select case when exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_support_permission_grants_consistent' and pg_get_constraintdef(oid) like '%createCourse%' and pg_get_constraintdef(oid) like '%manageOperations%' and convalidated) and exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_support_permission_views_consistent' and pg_get_constraintdef(oid) like '%viewFinancialAnalysis%' and pg_get_constraintdef(oid) like '%viewAudit%' and convalidated) then not exists (select 1 from profiles where support_permission_grants is null or support_permission_views is null or cardinality(support_permission_grants) <> 0 or cardinality(support_permission_views) <> 0) else false end as present",
    },
  ];
