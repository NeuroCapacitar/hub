const JOURNAL_TAG_PATTERN = /^(\d{4})_[a-z0-9_]+$/;
const SQL_WHITESPACE_PATTERN = /\s+/g;
const EXPECTED_CLAIM_PAIR_CHECK =
  "(render_claim_token is null) = (render_claimed_at is null)";
const EXPECTED_READY_ARTIFACT_CHECK =
  "render_status <> 'ready' or (pdf_storage_key is not null and pdf_sha256 is not null and rendered_at is not null and render_claim_token is null) or pdf_purged_at is not null";
const EXPECTED_PDF_PURGED_STATE_CHECK =
  "pdf_purged_at is null or (status = 'revoked' and pdf_storage_key is null and pdf_sha256 is null and render_claim_token is null)";
const EXPECTED_PREVIEW_PURGED_STATE_CHECK =
  "preview_purged_at is null or (status = 'revoked' and preview_sha256 is null)";
const EXPECTED_REVOCATION_TOMBSTONE_CODE_HASH_CHECK =
  "certificate_revocation_tombstones.code_hash ~ '^[a-f0-9]{64}$'";

interface DrizzleSnapshotTable {
  checkConstraints?: Record<string, { value?: unknown }>;
  columns: Record<string, unknown>;
}

interface DrizzleSnapshot {
  enums: Record<string, unknown>;
  tables: Record<string, DrizzleSnapshotTable>;
}

export interface CertificateCatalogParityResult {
  errors: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseSnapshot = (value: unknown): DrizzleSnapshot | null => {
  if (!(isRecord(value) && isRecord(value.tables) && isRecord(value.enums))) {
    return null;
  }

  return value as unknown as DrizzleSnapshot;
};

const countToken = (source: string, token: string): number =>
  source.split(token).length - 1;

const normalizeCheckExpression = (source: string): string =>
  source
    .toLowerCase()
    .replaceAll('"certificates".', "")
    .replaceAll('"', "")
    .replace(SQL_WHITESPACE_PATTERN, "");

const requireSchemaToken = ({
  errors,
  schemaSource,
  token,
}: {
  errors: string[];
  schemaSource: string;
  token: string;
}): void => {
  if (!schemaSource.includes(token)) {
    errors.push(`Schema sem declaracao esperada: ${token}.`);
  }
};

const requireSnapshotColumn = ({
  columns,
  errors,
  name,
}: {
  columns: Record<string, unknown>;
  errors: string[];
  name: string;
}): void => {
  if (!(name in columns)) {
    errors.push(`Snapshot de certificates sem coluna ${name}.`);
  }
};

const requireSnapshotCheck = ({
  checkConstraints,
  errors,
  expected,
  name,
}: {
  checkConstraints: Record<string, { value?: unknown }>;
  errors: string[];
  expected: string;
  name: string;
}): void => {
  const check = checkConstraints[name];
  if (!check) {
    errors.push(`Snapshot sem check ${name}.`);
    return;
  }

  const value = normalizeCheckExpression(String(check.value ?? ""));
  if (value !== normalizeCheckExpression(expected)) {
    errors.push(`Check ${name} diverge da expressao esperada.`);
  }
};

const validateSchema = (schemaSource: string): string[] => {
  const errors: string[] = [];
  const expectedTokens = [
    '"certificate_render_status"',
    '"certificate_template_status"',
    '"certificate_issuer_profiles"',
    '"certificate_templates"',
    '"certificate_revocation_tombstones"',
    '"certificate_ever_issued"',
    '"pdf_storage_key"',
    '"pdf_sha256"',
    '"pdf_purged_at"',
    '"preview_purged_at"',
    '"rendered_at"',
    '"render_status"',
    '"render_snapshot"',
    '"render_claim_token"',
    '"render_claimed_at"',
    '"certificates_render_claim_pair_check"',
    '"certificates_ready_artifact_check"',
    '"certificates_pdf_purged_state_check"',
    '"certificates_preview_purged_state_check"',
  ];

  for (const token of expectedTokens) {
    requireSchemaToken({ errors, schemaSource, token });
  }

  if (countToken(schemaSource, '"certificate_template_id"') !== 1) {
    errors.push(
      "Schema deve declarar certificate_template_id somente em certificates."
    );
  }
  if (schemaSource.includes('"pdf_url"')) {
    errors.push("Schema legado ainda declara a coluna removida pdf_url.");
  }

  return errors;
};

const validateSnapshotAuthorities = (snapshot: DrizzleSnapshot): string[] => {
  const errors: string[] = [];

  if (!snapshot.tables["public.certificate_issuer_profiles"]) {
    errors.push("Snapshot sem tabela public.certificate_issuer_profiles.");
  }
  if (!snapshot.tables["public.certificate_templates"]) {
    errors.push("Snapshot sem tabela public.certificate_templates.");
  }
  if (!snapshot.tables["public.certificate_revocation_tombstones"]) {
    errors.push(
      "Snapshot sem tabela public.certificate_revocation_tombstones."
    );
  }
  const completions = snapshot.tables["public.course_completions"];
  if (!completions) {
    errors.push("Snapshot sem tabela public.course_completions.");
  } else if (!("certificate_ever_issued" in completions.columns)) {
    errors.push(
      "Snapshot de course_completions sem coluna certificate_ever_issued."
    );
  }
  if (!snapshot.enums["public.certificate_render_status"]) {
    errors.push("Snapshot sem enum public.certificate_render_status.");
  }
  if (!snapshot.enums["public.certificate_template_status"]) {
    errors.push("Snapshot sem enum public.certificate_template_status.");
  }
  const tombstones =
    snapshot.tables["public.certificate_revocation_tombstones"];
  if (tombstones) {
    for (const name of ["code_hash", "revoked_at"]) {
      if (!(name in tombstones.columns)) {
        errors.push(
          `Snapshot de certificate_revocation_tombstones sem coluna ${name}.`
        );
      }
    }
    requireSnapshotCheck({
      checkConstraints: tombstones.checkConstraints ?? {},
      errors,
      expected: EXPECTED_REVOCATION_TOMBSTONE_CODE_HASH_CHECK,
      name: "certificate_revocation_tombstones_code_hash_check",
    });
  }

  return errors;
};

const validateSnapshot = (snapshot: DrizzleSnapshot): string[] => {
  const errors = validateSnapshotAuthorities(snapshot);
  const certificates = snapshot.tables["public.certificates"];

  if (!certificates) {
    errors.push("Snapshot sem tabela public.certificates.");
    return errors;
  }

  const certificateTemplateTables = Object.entries(snapshot.tables)
    .filter(([, table]) => "certificate_template_id" in table.columns)
    .map(([tableName]) => tableName);
  if (
    certificateTemplateTables.length !== 1 ||
    certificateTemplateTables[0] !== "public.certificates"
  ) {
    errors.push(
      "certificate_template_id deve existir somente em public.certificates."
    );
  }

  const requiredColumns = [
    "certificate_template_id",
    "pdf_storage_key",
    "pdf_sha256",
    "pdf_purged_at",
    "preview_purged_at",
    "rendered_at",
    "render_status",
    "render_snapshot",
    "render_claim_token",
    "render_claimed_at",
  ];
  for (const name of requiredColumns) {
    requireSnapshotColumn({
      columns: certificates.columns,
      errors,
      name,
    });
  }

  if (
    Object.values(snapshot.tables).some((table) => "pdf_url" in table.columns)
  ) {
    errors.push("Catalogo legado ainda contem a coluna removida pdf_url.");
  }

  const checks = certificates.checkConstraints ?? {};
  const expectedChecks = [
    {
      expected: EXPECTED_CLAIM_PAIR_CHECK,
      name: "certificates_render_claim_pair_check",
    },
    {
      expected: EXPECTED_READY_ARTIFACT_CHECK,
      name: "certificates_ready_artifact_check",
    },
    {
      expected: EXPECTED_PDF_PURGED_STATE_CHECK,
      name: "certificates_pdf_purged_state_check",
    },
    {
      expected: EXPECTED_PREVIEW_PURGED_STATE_CHECK,
      name: "certificates_preview_purged_state_check",
    },
  ] as const;

  for (const check of expectedChecks) {
    requireSnapshotCheck({
      checkConstraints: checks,
      errors,
      ...check,
    });
  }

  return errors;
};

export const resolveLatestSnapshotFileName = (
  journalTags: string[]
): string => {
  const latestTag = journalTags.at(-1);
  const number = latestTag ? JOURNAL_TAG_PATTERN.exec(latestTag)?.[1] : null;

  if (!number) {
    throw new Error(
      "Nao foi possivel resolver o snapshot pela ultima entrada do journal."
    );
  }

  return `${number}_snapshot.json`;
};

export const validateCertificateCatalogParity = ({
  schemaSource,
  snapshot: snapshotValue,
}: {
  schemaSource: string;
  snapshot: unknown;
}): CertificateCatalogParityResult => {
  const snapshot = parseSnapshot(snapshotValue);
  if (!snapshot) {
    return { errors: ["Snapshot Drizzle invalido para validar certificados."] };
  }

  return {
    errors: [...validateSchema(schemaSource), ...validateSnapshot(snapshot)],
  };
};
