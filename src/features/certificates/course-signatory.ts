import "server-only";

import { getPool } from "@/db";
import { writeAuditLog } from "@/features/admin/audit-log";
import { CertificateTemplateDomainError } from "./template-errors";
import {
  CERTIFICATE_SIGNER_NAME_MAX_LENGTH,
  CERTIFICATE_SIGNER_ROLE_MAX_LENGTH,
} from "./template-rules";

export const normalizeCourseCertificateSignatory = ({
  signerName,
  signerRole,
}: {
  signerName: string;
  signerRole: string;
}): { signerName: string | null; signerRole: string | null } => {
  const normalizedName = signerName.trim() || null;
  const normalizedRole = signerRole.trim() || null;

  if (Boolean(normalizedName) !== Boolean(normalizedRole)) {
    throw new CertificateTemplateDomainError("Informe nome e cargo juntos.");
  }
  if (
    normalizedName &&
    normalizedName.length > CERTIFICATE_SIGNER_NAME_MAX_LENGTH
  ) {
    throw new CertificateTemplateDomainError(
      `O nome deve ter até ${CERTIFICATE_SIGNER_NAME_MAX_LENGTH} caracteres.`
    );
  }
  if (
    normalizedRole &&
    normalizedRole.length > CERTIFICATE_SIGNER_ROLE_MAX_LENGTH
  ) {
    throw new CertificateTemplateDomainError(
      `O cargo deve ter até ${CERTIFICATE_SIGNER_ROLE_MAX_LENGTH} caracteres.`
    );
  }

  return { signerName: normalizedName, signerRole: normalizedRole };
};

export const saveCourseCertificateSignatory = async ({
  actorUserId,
  courseId,
  signerName,
  signerRole,
}: {
  actorUserId: string;
  courseId: string;
  signerName: string;
  signerRole: string;
}): Promise<void> => {
  const normalized = normalizeCourseCertificateSignatory({
    signerName,
    signerRole,
  });
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const result = await client.query<{
      certificate_signer_name: string | null;
      certificate_signer_role: string | null;
    }>(
      `select certificate_signer_name, certificate_signer_role
       from courses
       where id = $1
       for update`,
      [courseId]
    );
    const current = result.rows[0];
    if (!current) {
      throw new CertificateTemplateDomainError("Curso não encontrado.");
    }

    const changes: Record<
      string,
      { after: string | null; before: string | null }
    > = {};
    if (current.certificate_signer_name !== normalized.signerName) {
      changes.certificateSignerName = {
        after: normalized.signerName,
        before: current.certificate_signer_name,
      };
    }
    if (current.certificate_signer_role !== normalized.signerRole) {
      changes.certificateSignerRole = {
        after: normalized.signerRole,
        before: current.certificate_signer_role,
      };
    }

    if (Object.keys(changes).length > 0) {
      await client.query(
        `update courses
         set certificate_signer_name = $2,
             certificate_signer_role = $3,
             updated_at = now()
         where id = $1`,
        [courseId, normalized.signerName, normalized.signerRole]
      );
      await writeAuditLog({
        action: "certificate.course_signatory_updated",
        actorUserId,
        client,
        metadata: { changes },
        targetId: courseId,
        targetType: "course",
      });
    }

    await client.query("commit");
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Preserve the original failure if rollback is unavailable.
    }
    throw error;
  } finally {
    client.release();
  }
};
