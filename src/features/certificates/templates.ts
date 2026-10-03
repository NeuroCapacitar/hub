import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getPool } from "@/db";
import { uploadPrivateR2Object } from "@/features/storage/r2";
import { requirePermission } from "@/lib/auth-permissions";
import { normalizeCnpj } from "@/lib/cnpj";
import { parseCertificateTemplateDraft } from "./render-snapshot";
import {
  prepareCertificateTemplateAssetReferences,
  queueCertificateTemplateAssetCleanup,
  scheduleCertificateTemplateAssetCleanup,
} from "./template-asset-cleanup";
import { isCertificateTemplateAssetKey } from "./template-asset-key";
import {
  assertCertificateTemplateAssetNamespace,
  assertCertificateTemplateAssetOwnership,
} from "./template-asset-ownership";
import { CertificateTemplateDomainError } from "./template-errors";
import {
  normalizeCertificateBackground,
  normalizeCertificateSignature,
} from "./template-image";
import type { CertificateTemplateSpec } from "./template-rules";
import {
  CERTIFICATE_SIGNATORY_REQUIRED_MESSAGE,
  isCertificateSignatoryConfigured,
  validateCertificateTemplate,
} from "./template-rules";

export const runCertificateTemplateAssetMutation = async <Result>({
  courseId,
  operation,
}: {
  courseId: string;
  operation: (trackUploadedKey: (key: string) => void) => Promise<Result>;
}): Promise<Result> => {
  const uploadedKeys: string[] = [];
  const trackUploadedKey = (key: string): void => {
    uploadedKeys.push(key);
  };

  try {
    return await operation(trackUploadedKey);
  } catch (error) {
    if (uploadedKeys.length > 0) {
      try {
        await scheduleCertificateTemplateAssetCleanup({
          courseId,
          keys: uploadedKeys,
        });
      } catch {
        // A falha original continua sendo a autoridade; o cleanup e idempotente.
      }
    }
    throw error;
  }
};

export const uploadCertificateBackground = async ({
  courseId,
  file,
}: {
  courseId: string;
  file: File;
}): Promise<string> => {
  const image = await normalizeCertificateBackground(file);
  const key = `certificates/templates/${courseId}/${randomUUID()}.webp`;
  await uploadPrivateR2Object({
    body: image.body,
    contentType: image.contentType,
    key,
  });
  return key;
};

export const uploadCertificateSignature = async ({
  courseId,
  file,
}: {
  courseId: string;
  file: File;
}): Promise<string> => {
  const image = await normalizeCertificateSignature(file);
  const key = `certificates/templates/${courseId}/signatures/${randomUUID()}.webp`;
  await uploadPrivateR2Object({
    body: image.body,
    contentType: image.contentType,
    key,
  });
  return key;
};

export const saveCertificateTemplateDraft = async ({
  actorUserId,
  courseId,
  signatureKey,
  spec,
  uploadedAssetKeys = [],
}: {
  actorUserId: string;
  courseId: string;
  signatureKey: string | null;
  spec: CertificateTemplateSpec;
  uploadedAssetKeys?: readonly string[];
}): Promise<string[]> => {
  if (
    !isCertificateTemplateAssetKey({
      courseId,
      key: spec.backgroundKey,
      kind: "background",
    }) ||
    (signatureKey !== null &&
      !isCertificateTemplateAssetKey({
        courseId,
        key: signatureKey,
        kind: "signature",
      }))
  ) {
    throw new CertificateTemplateDomainError(
      "Use somente imagens de certificado enviadas para este Curso."
    );
  }
  const errors = validateCertificateTemplate(spec);
  const firstError = errors[0];
  if (firstError) {
    throw new CertificateTemplateDomainError(firstError);
  }
  const specSha256 = createHash("sha256")
    .update(JSON.stringify(spec))
    .digest("hex");
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [courseId]
    );
    const previous = await client.query<{
      background_key: string;
      id: string;
      signature_key: string | null;
    }>(
      `select id, background_key, signature_key
       from certificate_templates
       where course_id = $1 and status = 'draft'
       limit 1
       for update`,
      [courseId]
    );
    const previousDraft = previous.rows[0];
    await assertCertificateTemplateAssetOwnership({
      backgroundKey: spec.backgroundKey,
      client,
      courseId,
      signatureKey,
      uploadedAssetKeys,
    });
    const referencesAvailable = await prepareCertificateTemplateAssetReferences(
      {
        client,
        keys: [spec.backgroundKey, signatureKey ?? ""],
      }
    );
    if (!referencesAvailable) {
      throw new CertificateTemplateDomainError(
        "Uma imagem deste rascunho ja foi removida. Recarregue a pagina e envie a imagem novamente."
      );
    }

    if (previousDraft) {
      await client.query(
        `update certificate_templates
         set background_key = $2, spec = $3::jsonb,
             signature_key = $4, updated_at = now()
         where id = $1`,
        [
          previousDraft.id,
          spec.backgroundKey,
          JSON.stringify(spec),
          signatureKey,
        ]
      );
    } else {
      await client.query(
        `insert into certificate_templates (course_id, version, status, background_key, spec, signature_key)
         values ($1, coalesce((select max(version) + 1 from certificate_templates where course_id = $1), 1), 'draft', $2, $3::jsonb, $4)`,
        [courseId, spec.backgroundKey, JSON.stringify(spec), signatureKey]
      );
    }

    const replacedKeys = [
      previousDraft?.background_key &&
      isCertificateTemplateAssetKey({
        courseId,
        key: previousDraft.background_key,
        kind: "background",
      })
        ? previousDraft.background_key
        : null,
      previousDraft?.signature_key &&
      isCertificateTemplateAssetKey({
        courseId,
        key: previousDraft.signature_key,
        kind: "signature",
      })
        ? previousDraft.signature_key
        : null,
    ].filter(
      (key): key is string =>
        Boolean(key) && key !== spec.backgroundKey && key !== signatureKey
    );
    await queueCertificateTemplateAssetCleanup({
      client,
      courseId,
      keys: replacedKeys,
    });
    await client.query(
      `
        insert into audit_logs (actor_user_id, action, target_type, target_id, metadata)
        values ($1, $2, 'certificate_template', $3, $4::jsonb)
      `,
      [
        actorUserId,
        "certificate.template_draft_saved",
        courseId,
        JSON.stringify({ replacedAssetCount: replacedKeys.length, specSha256 }),
      ]
    );
    await client.query("commit");
    return replacedKeys;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export interface CertificateTemplateSummary {
  backgroundKey: string;
  backgroundUrl: string;
  id: string;
  signatureKey: string | null;
  signatureUrl: string | null;
  spec: CertificateTemplateSpec;
  status: "draft" | "published" | "superseded";
  version: number;
}

export const getCertificateTemplatesForCourse = async (
  courseId: string
): Promise<CertificateTemplateSummary[]> => {
  await requirePermission("viewCourses");
  const { rows } = await getPool().query<{
    background_key: string;
    id: string;
    signature_key: string | null;
    spec: unknown;
    status: "draft" | "published" | "superseded";
    version: number;
  }>(
    `select id, version, status, background_key, spec, signature_key
     from certificate_templates
     where course_id = $1
     order by version desc`,
    [courseId]
  );
  return await Promise.all(
    rows.map(async (row) => ({
      backgroundKey: row.background_key,
      backgroundUrl: `/api/admin/courses/${courseId}/certificate-templates/${row.id}/assets/background?v=${encodeURIComponent(row.background_key)}`,
      id: row.id,
      signatureKey: row.signature_key,
      signatureUrl: row.signature_key
        ? `/api/admin/courses/${courseId}/certificate-templates/${row.id}/assets/signature?v=${encodeURIComponent(row.signature_key)}`
        : null,
      spec: parseCertificateTemplateDraft(row.spec),
      status: row.status,
      version: row.version,
    }))
  );
};

interface CertificateIssuerProfileRow {
  cnpj: string | null;
  display_name: string | null;
  legal_name: string | null;
}

const isCertificateIssuerProfileComplete = (
  profile: CertificateIssuerProfileRow | undefined
): boolean => {
  if (!profile) {
    return false;
  }
  return Boolean(
    profile.legal_name?.trim() &&
      profile.display_name?.trim() &&
      normalizeCnpj(profile.cnpj ?? "")
  );
};

export const getCertificateIssuerProfileForPreview = async (): Promise<{
  cnpj: string | null;
  configured: boolean;
  displayName: string | null;
}> => {
  await requirePermission("viewSettings");
  const result = await getPool().query<CertificateIssuerProfileRow>(
    `select cnpj, display_name, legal_name
     from certificate_issuer_profiles
     where id = 'global'
     limit 1`
  );
  const profile = result.rows[0];

  return {
    cnpj: profile ? normalizeCnpj(profile.cnpj ?? "") : null,
    configured: isCertificateIssuerProfileComplete(profile),
    displayName: profile?.display_name?.trim() || null,
  };
};

export const publishCertificateTemplate = async (
  courseId: string,
  actorUserId: string
): Promise<void> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [courseId]
    );
    const issuer = await client.query<CertificateIssuerProfileRow>(
      `select cnpj, display_name, legal_name
       from certificate_issuer_profiles
       where id = 'global'
       for share`
    );
    if (!isCertificateIssuerProfileComplete(issuer.rows[0])) {
      throw new CertificateTemplateDomainError(
        "Preencha o perfil emissor em Configuracoes antes de publicar o certificado."
      );
    }
    const draft = await client.query<{
      background_key: string;
      id: string;
      signature_key: string | null;
      spec: unknown;
    }>(
      `select id, background_key, signature_key, spec
       from certificate_templates
       where course_id = $1 and status = 'draft'
       for update`,
      [courseId]
    );
    if (!draft.rows[0]) {
      throw new CertificateTemplateDomainError(
        "Crie e salve um rascunho de certificado antes de publicar."
      );
    }
    const signatory = await client.query<{
      certificate_signer_name: string | null;
      certificate_signer_role: string | null;
    }>(
      `select certificate_signer_name, certificate_signer_role
       from courses
       where id = $1
       for share`,
      [courseId]
    );
    const course = signatory.rows[0];
    if (!course) {
      throw new CertificateTemplateDomainError("Curso não encontrado.");
    }
    if (
      !isCertificateSignatoryConfigured(
        course.certificate_signer_name,
        course.certificate_signer_role
      )
    ) {
      throw new CertificateTemplateDomainError(
        CERTIFICATE_SIGNATORY_REQUIRED_MESSAGE
      );
    }
    const template = draft.rows[0];
    const spec = parseCertificateTemplateDraft(template.spec);
    assertCertificateTemplateAssetNamespace({
      backgroundKey: template.background_key,
      courseId,
      signatureKey: template.signature_key,
    });
    if (spec.backgroundKey !== template.background_key) {
      throw new CertificateTemplateDomainError(
        "A arte do template está inconsistente. Salve o rascunho novamente."
      );
    }
    const firstError = validateCertificateTemplate(spec)[0];
    if (firstError) {
      throw new CertificateTemplateDomainError(firstError);
    }
    const assetsAvailable = await prepareCertificateTemplateAssetReferences({
      client,
      keys: [template.background_key, template.signature_key ?? ""],
    });
    if (!assetsAvailable) {
      throw new CertificateTemplateDomainError(
        "A arte do template não está disponível. Envie a imagem novamente."
      );
    }
    await client.query(
      "update certificate_templates set status = 'superseded', updated_at = now() where course_id = $1 and status = 'published'",
      [courseId]
    );
    await client.query(
      "update certificate_templates set status = 'published', published_at = now(), updated_at = now() where id = $1",
      [draft.rows[0].id]
    );
    await client.query(
      "update courses set certificate_enabled = true, updated_at = now() where id = $1",
      [courseId]
    );
    await client.query(
      `
        insert into audit_logs (actor_user_id, action, target_type, target_id, metadata)
        values ($1, $2, 'certificate_template', $3, $4::jsonb)
      `,
      [
        actorUserId,
        "certificate.template_published",
        courseId,
        JSON.stringify({ templateId: draft.rows[0].id }),
      ]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const disableCertificateForCourse = async (
  courseId: string,
  actorUserId: string
): Promise<void> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [courseId]
    );
    const result = await client.query(
      "update courses set certificate_enabled = false, updated_at = now() where id = $1",
      [courseId]
    );
    if (result.rowCount !== 1) {
      throw new CertificateTemplateDomainError("Curso nao localizado.");
    }
    await client.query(
      `
        insert into audit_logs (actor_user_id, action, target_type, target_id, metadata)
        values ($1, $2, 'course', $3, '{}'::jsonb)
      `,
      [actorUserId, "certificate.disabled", courseId]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const enableCertificateForCourse = async (
  courseId: string,
  actorUserId: string
): Promise<void> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [courseId]
    );
    const prerequisite = await client.query<{
      id: string;
      issuer_cnpj: string | null;
      issuer_display_name: string | null;
      issuer_legal_name: string | null;
      signer_name: string | null;
      signer_role: string | null;
    }>(
      `
        select template.id,
               course.certificate_signer_name as signer_name,
               course.certificate_signer_role as signer_role,
               issuer.cnpj as issuer_cnpj,
               issuer.display_name as issuer_display_name,
               issuer.legal_name as issuer_legal_name
        from certificate_templates template
        join courses course on course.id = template.course_id
        join certificate_issuer_profiles issuer on issuer.id = 'global'
        where template.course_id = $1
          and template.status = 'published'
        limit 1
      `,
      [courseId]
    );

    const publishedTemplate = prerequisite.rows[0];
    if (!publishedTemplate) {
      throw new CertificateTemplateDomainError(
        "Publique um template e configure o perfil emissor antes de ligar certificados."
      );
    }
    if (
      !isCertificateIssuerProfileComplete({
        cnpj: publishedTemplate.issuer_cnpj,
        display_name: publishedTemplate.issuer_display_name,
        legal_name: publishedTemplate.issuer_legal_name,
      })
    ) {
      throw new CertificateTemplateDomainError(
        "Preencha o perfil emissor em Configuracoes antes de ligar certificados."
      );
    }
    if (
      !isCertificateSignatoryConfigured(
        publishedTemplate.signer_name,
        publishedTemplate.signer_role
      )
    ) {
      throw new CertificateTemplateDomainError(
        CERTIFICATE_SIGNATORY_REQUIRED_MESSAGE
      );
    }

    const result = await client.query(
      "update courses set certificate_enabled = true, updated_at = now() where id = $1",
      [courseId]
    );

    if (result.rowCount !== 1) {
      throw new CertificateTemplateDomainError("Curso nao localizado.");
    }
    await client.query(
      `
        insert into audit_logs (actor_user_id, action, target_type, target_id, metadata)
        values ($1, $2, 'course', $3, '{}'::jsonb)
      `,
      [actorUserId, "certificate.enabled", courseId]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};
