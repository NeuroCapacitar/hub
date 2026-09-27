import "server-only";
import { getPool } from "@/db";
import { OUTBOX_TOPICS } from "@/features/outbox/rules";
import { deleteR2Objects } from "@/features/storage/r2";
import { createCorrelationId, logOperationalEvent } from "@/lib/observability";
import { hashCertificateVerificationCode } from "./certificate-code";
import {
  CERTIFICATE_RENDER_CLAIM_LEASE_MINUTES,
  REVOKED_CERTIFICATE_DATA_RETENTION_DAYS,
} from "./rules";

const RECONCILIATION_BATCH_LIMIT = 100;

const REVOKED_ORPHAN_PREDICATE = `
  certificate.status = 'revoked'
  and certificate.pdf_storage_key is null
  and certificate.pdf_purged_at is null
  and certificate.render_status in ('pending', 'failed')
  and certificate.render_claim_token is null
  and certificate.updated_at < now() - ($2 * interval '1 minute')
  and not exists (
    select 1
    from outbox_messages message
    where message.aggregate_id = certificate.id::text
      and message.topic = $3
      and message.status = 'processing'
  )
  and not exists (
    select 1
    from audit_logs audit
    where audit.action = 'certificate.artifact_reconciled'
      and audit.target_type = 'certificate'
      and audit.target_id = certificate.id::text
  )
`;

const reportPreviewPurgeFailure = (certificateId: string): void => {
  try {
    logOperationalEvent({
      aggregateId: certificateId,
      correlationId: createCorrelationId(null),
      errorCode: "certificate_preview_purge_failed",
      operation: "certificate.preview_purge",
      outcome: "failure",
      provider: "r2",
      resourceId: certificateId,
    });
  } catch {
    // A failed log sink must not change the committed revocation result.
  }
};

export const purgeRevokedCertificatePreview = async ({
  actorUserId = null,
  certificateId,
}: {
  actorUserId?: string | null;
  certificateId: string;
}): Promise<boolean> => {
  const pool = getPool();
  try {
    const state = await pool.query<{
      preview_purged_at: Date | null;
      status: "revoked" | "valid";
    }>(
      `select status, preview_purged_at
       from certificates
       where id = $1
       limit 1`,
      [certificateId]
    );
    const certificate = state.rows[0];
    if (certificate?.status !== "revoked") {
      return false;
    }
    if (certificate.preview_purged_at) {
      return true;
    }

    await deleteR2Objects([
      `certificates/${certificateId}/certificate-preview.png`,
    ]);
    const result = await pool.query(
      `with purged as (
         update certificates
         set preview_sha256 = null,
             preview_purged_at = now(),
             updated_at = now()
         where id = $1
           and status = 'revoked'
           and preview_purged_at is null
         returning id
       )
       insert into audit_logs (
         actor_user_id,
         action,
         target_type,
         target_id,
         metadata
       )
       select
         $2,
         'certificate.artifact_purged',
         'certificate',
         id,
         '{"artifact":"preview_png","trigger":"revocation"}'::jsonb
       from purged
       returning target_id`,
      [certificateId, actorUserId]
    );
    if (result.rowCount === 1) {
      return true;
    }

    const latest = await pool.query<{ preview_purged_at: Date | null }>(
      `select preview_purged_at
       from certificates
       where id = $1
         and status = 'revoked'
       limit 1`,
      [certificateId]
    );
    return Boolean(latest.rows[0]?.preview_purged_at);
  } catch {
    reportPreviewPurgeFailure(certificateId);
    return false;
  }
};

const reconcileRevokedCertificatePreviews = async ({
  shouldContinue,
}: {
  shouldContinue: () => Promise<boolean>;
}): Promise<number> => {
  const pool = getPool();
  const candidates = await pool.query<{ id: string }>(
    `select id
     from certificates
     where status = 'revoked'
       and preview_purged_at is null
     order by revoked_at asc, id asc
     limit $1`,
    [RECONCILIATION_BATCH_LIMIT]
  );

  let purged = 0;
  for (const candidate of candidates.rows) {
    if (!(await shouldContinue())) {
      break;
    }
    if (await purgeRevokedCertificatePreview({ certificateId: candidate.id })) {
      purged += 1;
    }
  }
  return purged;
};

const reconcileOrphanedCertificatePdfs = async ({
  shouldContinue,
}: {
  shouldContinue: () => Promise<boolean>;
}): Promise<number> => {
  const pool = getPool();
  const candidates = await pool.query<{ id: string }>(
    `select certificate.id
     from certificates certificate
     where ${REVOKED_ORPHAN_PREDICATE}
     order by certificate.updated_at asc
     limit $1`,
    [
      RECONCILIATION_BATCH_LIMIT,
      CERTIFICATE_RENDER_CLAIM_LEASE_MINUTES,
      OUTBOX_TOPICS.certificateRender,
    ]
  );

  let reconciled = 0;
  for (const candidate of candidates.rows) {
    if (!(await shouldContinue())) {
      break;
    }
    const verification = await pool.query<{ id: string }>(
      `select certificate.id
       from certificates certificate
       where certificate.id = $1
         and ${REVOKED_ORPHAN_PREDICATE}
       limit 1`,
      [
        candidate.id,
        CERTIFICATE_RENDER_CLAIM_LEASE_MINUTES,
        OUTBOX_TOPICS.certificateRender,
      ]
    );
    if (!verification.rows[0]) {
      continue;
    }

    await deleteR2Objects([`certificates/${candidate.id}/certificate.pdf`]);
    await pool.query(
      `insert into audit_logs (action, target_type, target_id, metadata)
       values (
         'certificate.artifact_reconciled',
         'certificate',
         $1,
         '{"artifact":"pdf"}'::jsonb
       )`,
      [candidate.id]
    );
    reconciled += 1;
  }

  return reconciled;
};

const purgeExpiredRevokedCertificates = async ({
  shouldContinue,
}: {
  shouldContinue: () => Promise<boolean>;
}): Promise<number> => {
  const pool = getPool();
  const candidates = await pool.query<{
    code: string;
    id: string;
    pdf_storage_key: string | null;
    revoked_at: Date;
  }>(
    `select certificate.id, certificate.code, certificate.pdf_storage_key,
            certificate.revoked_at
     from certificates certificate
     where certificate.status = 'revoked'
       and certificate.revoked_at <= now() - ($2 * interval '1 day')
       and certificate.preview_purged_at is not null
       and certificate.render_claim_token is null
       and not exists (
         select 1
         from outbox_messages message
         where message.aggregate_type = 'certificate'
           and message.aggregate_id = certificate.id::text
           and message.status = 'processing'
       )
     order by certificate.revoked_at asc, certificate.id asc
     limit $1`,
    [RECONCILIATION_BATCH_LIMIT, REVOKED_CERTIFICATE_DATA_RETENTION_DAYS]
  );

  let purged = 0;
  for (const candidate of candidates.rows) {
    if (!(await shouldContinue())) {
      break;
    }
    if (candidate.pdf_storage_key) {
      await deleteR2Objects([candidate.pdf_storage_key]);
    }

    const pdfState = await pool.query(
      `update certificates
       set pdf_storage_key = null,
           pdf_sha256 = null,
           pdf_purged_at = case
             when pdf_storage_key is not null or pdf_purged_at is not null
               then coalesce(pdf_purged_at, now())
             else null
           end,
           updated_at = now()
       where id = $1
         and status = 'revoked'
         and pdf_storage_key is not distinct from $2
         and render_claim_token is null
       returning id`,
      [candidate.id, candidate.pdf_storage_key]
    );
    if (pdfState.rowCount !== 1) {
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("begin");
      const lockedCertificate = await client.query<{
        code: string;
        id: string;
        revoked_at: Date;
      }>(
        `select id, code, revoked_at
         from certificates
         where id = $1
           and status = 'revoked'
           and revoked_at <= now() - ($2 * interval '1 day')
           and preview_purged_at is not null
           and render_claim_token is null
         for update`,
        [candidate.id, REVOKED_CERTIFICATE_DATA_RETENTION_DAYS]
      );
      const certificate = lockedCertificate.rows[0];
      if (!certificate) {
        await client.query("rollback");
        continue;
      }

      const outboxMessages = await client.query<{ status: string }>(
        `select status
         from outbox_messages
         where aggregate_type = 'certificate'
           and aggregate_id = $1
         for update`,
        [candidate.id]
      );
      if (
        outboxMessages.rows.some((message) => message.status === "processing")
      ) {
        await client.query("rollback");
        continue;
      }

      await client.query(
        `delete from outbox_messages
         where aggregate_type = 'certificate'
           and aggregate_id = $1`,
        [candidate.id]
      );
      await client.query(
        `delete from audit_logs
         where target_type = 'certificate'
           and target_id = $1`,
        [candidate.id]
      );
      await client.query(
        `insert into certificate_revocation_tombstones (code_hash, revoked_at)
         values ($1, $2)
         on conflict (code_hash) do update
         set revoked_at = excluded.revoked_at`,
        [
          hashCertificateVerificationCode(certificate.code),
          certificate.revoked_at,
        ]
      );
      const deletedCertificate = await client.query(
        `delete from certificates
         where id = $1
           and status = 'revoked'
         returning id`,
        [candidate.id]
      );
      if (deletedCertificate.rowCount !== 1) {
        await client.query("rollback");
        continue;
      }

      await client.query("commit");
      purged += 1;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  return purged;
};

export const reconcileRevokedCertificateArtifacts = async ({
  shouldContinue = async () => true,
}: {
  shouldContinue?: () => Promise<boolean>;
} = {}): Promise<number> => {
  const pool = getPool();

  await pool.query(
    `update certificates
     set render_claim_token = null,
         render_claimed_at = null,
         updated_at = now()
     where status = 'revoked'
       and render_claim_token is not null
       and render_claimed_at < now() - ($1 * interval '1 minute')`,
    [CERTIFICATE_RENDER_CLAIM_LEASE_MINUTES]
  );

  const previewsPurged = await reconcileRevokedCertificatePreviews({
    shouldContinue,
  });
  if (!(await shouldContinue())) {
    return previewsPurged;
  }

  const orphanedPdfsReconciled = await reconcileOrphanedCertificatePdfs({
    shouldContinue,
  });
  if (!(await shouldContinue())) {
    return previewsPurged + orphanedPdfsReconciled;
  }

  const expiredCertificatesPurged = await purgeExpiredRevokedCertificates({
    shouldContinue,
  });
  return previewsPurged + orphanedPdfsReconciled + expiredCertificatesPurged;
};
