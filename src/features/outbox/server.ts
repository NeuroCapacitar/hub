import "server-only";
import type { Pool } from "pg";
import { getPool } from "@/db";
import type { OutboxMessageInput } from "./rules";
import type { ClaimedOutboxMessage, OutboxSupersededReason } from "./worker";

type OutboxQueryClient = Pick<Pool, "query">;

export const enqueueOutboxMessage = async ({
  client,
  message,
}: {
  client: OutboxQueryClient;
  message: OutboxMessageInput;
}): Promise<{ id: string | null; inserted: boolean }> => {
  const result = await client.query<{ id: string }>(
    `
      insert into outbox_messages (
        topic,
        aggregate_type,
        aggregate_id,
        idempotency_key,
        payload_version,
        payload
      )
      values ($1, $2, $3, $4, $5, $6::jsonb)
      on conflict (idempotency_key) do nothing
      returning id
    `,
    [
      message.topic,
      message.aggregateType,
      message.aggregateId,
      message.idempotencyKey,
      message.payloadVersion,
      JSON.stringify(message.payload),
    ]
  );
  const id = result.rows[0]?.id ?? null;
  return { id, inserted: Boolean(id) };
};

export const claimOutboxMessages = async ({
  client,
  limit,
  workerId,
}: {
  client: OutboxQueryClient;
  limit: number;
  workerId: string;
}): Promise<ClaimedOutboxMessage[]> => {
  const result = await client.query<ClaimedOutboxMessage>(
    `
      with candidates as (
        select id
        from outbox_messages
        where (
          status in ('pending', 'retrying')
          and available_at <= now()
        ) or (
          status = 'processing'
          and locked_at < now() - interval '10 minutes'
        )
        order by available_at asc, created_at asc
        for update skip locked
        limit $2
      )
      update outbox_messages as message
      set status = 'processing',
          attempts = message.attempts + 1,
          locked_at = now(),
          locked_by = $1,
          updated_at = now()
      from candidates
      where message.id = candidates.id
      returning
        message.id,
        message.topic,
        message.aggregate_type as "aggregateType",
        message.aggregate_id as "aggregateId",
        message.idempotency_key as "idempotencyKey",
        message.payload_version as "payloadVersion",
        message.payload,
        message.attempts
    `,
    [workerId, limit]
  );
  return result.rows;
};

export const markOutboxMessageDelivered = async ({
  client,
  id,
  workerId,
}: {
  client: OutboxQueryClient;
  id: string;
  workerId: string;
}): Promise<boolean> => {
  const result = await client.query(
    `
      update outbox_messages
      set status = 'delivered',
          delivered_at = now(),
          locked_at = null,
          locked_by = null,
          last_error_code = null,
          updated_at = now()
      where id = $1 and status = 'processing' and locked_by = $2
    `,
    [id, workerId]
  );
  return result.rowCount === 1;
};

export const markOutboxMessageForRetry = async ({
  client,
  errorCode,
  id,
  retryDelayMs,
  workerId,
}: {
  client: OutboxQueryClient;
  errorCode: string;
  id: string;
  retryDelayMs: number;
  workerId: string;
}): Promise<boolean> => {
  const result = await client.query(
    `
      update outbox_messages
      set status = 'retrying',
          available_at = now() + ($3 * interval '1 millisecond'),
          locked_at = null,
          locked_by = null,
          last_error_code = $4,
          last_error_at = now(),
          updated_at = now()
      where id = $1 and status = 'processing' and locked_by = $2
    `,
    [id, workerId, retryDelayMs, errorCode]
  );
  return result.rowCount === 1;
};

export const markOutboxMessageDeferred = async ({
  client,
  errorCode,
  id,
  workerId,
}: {
  client: OutboxQueryClient;
  errorCode: string;
  id: string;
  workerId: string;
}): Promise<boolean> => {
  const result = await client.query(
    `
      update outbox_messages
      set status = 'retrying',
          attempts = greatest(attempts - 1, 0),
          available_at = now() + interval '24 hours',
          locked_at = null,
          locked_by = null,
          last_error_code = $3,
          last_error_at = now(),
          updated_at = now()
      where id = $1 and status = 'processing' and locked_by = $2
    `,
    [id, workerId, errorCode]
  );
  return result.rowCount === 1;
};

export const markOutboxMessageSuperseded = async ({
  client,
  errorCode,
  id,
  workerId,
}: {
  client: OutboxQueryClient;
  errorCode: OutboxSupersededReason;
  id: string;
  workerId: string;
}): Promise<boolean> => {
  const result = await client.query(
    `
      update outbox_messages
      set status = 'superseded',
          superseded_at = now(),
          delivered_at = null,
          locked_at = null,
          locked_by = null,
          last_error_code = $3,
          last_error_at = now(),
          updated_at = now()
      where id = $1 and status = 'processing' and locked_by = $2
    `,
    [id, workerId, errorCode]
  );
  return result.rowCount === 1;
};

export const markOutboxMessageDeadLetter = async ({
  client,
  errorCode,
  id,
  workerId,
}: {
  client: OutboxQueryClient;
  errorCode: string;
  id: string;
  workerId: string;
}): Promise<boolean> => {
  const result = await client.query<{ transitioned: boolean }>(
    `
      with transitioned as (
        update outbox_messages as message
        set status = 'dead_letter',
            locked_at = null,
            locked_by = null,
            last_error_code = $3,
            last_error_at = now(),
            updated_at = now()
        where message.id = $1
          and message.status = 'processing'
          and message.locked_by = $2
        returning message.topic, message.payload
      ), failed_certificate as (
        update certificates as certificate
        set render_status = 'failed',
            render_claim_token = null,
            render_claimed_at = null,
            updated_at = now()
        from transitioned as message
        where message.topic = 'certificate.render'
          and jsonb_typeof(message.payload) = 'object'
          and jsonb_typeof(message.payload -> 'certificateId') = 'string'
          and certificate.id::text = message.payload ->> 'certificateId'
          and certificate.render_status = 'pending'
          and certificate.render_claim_token is null
        returning certificate.id
      )
      select exists(select 1 from transitioned) as transitioned
    `,
    [id, workerId, errorCode]
  );
  return result.rows[0]?.transitioned === true;
};

export const requeueDeadLetterMessage = async ({
  actorUserId,
  client,
  messageId,
  reason,
}: {
  actorUserId: string;
  client: OutboxQueryClient;
  messageId: string;
  reason: string;
}): Promise<void> => {
  const requeued = await client.query<{ id: string }>(
    `
      update outbox_messages
      set status = 'retrying',
          attempts = 0,
          manual_reprocess_count = manual_reprocess_count + 1,
          available_at = now(),
          locked_at = null,
          locked_by = null,
          last_error_code = null,
          last_error_at = null,
          updated_at = now()
      where id = $1
        and status = 'dead_letter'
        and manual_reprocess_count = 0
        and (
          topic <> 'email.support-request'
          or exists (
            select 1
            from support_requests
            where outbox_messages.aggregate_type = 'support_request'
              and support_requests.id::text = outbox_messages.aggregate_id
          )
        )
      returning id
    `,
    [messageId]
  );

  if (!requeued.rows[0]) {
    const state = await client.query<{
      manual_reprocess_count: number;
      source_exists: boolean;
      status: string;
      topic: string;
    }>(
      `
        select message.status,
               message.topic,
               message.manual_reprocess_count,
        case
                 when message.topic = 'email.support-request' then exists (
                   select 1
                   from support_requests
                   where message.aggregate_type = 'support_request'
                     and support_requests.id::text = message.aggregate_id
                 )
                 else true
               end as source_exists
        from outbox_messages message
        where message.id = $1
      `,
      [messageId]
    );
    const stateRow = state.rows[0];
    if (
      stateRow?.status === "dead_letter" &&
      stateRow.manual_reprocess_count === 0 &&
      stateRow.topic === "email.support-request" &&
      !stateRow.source_exists
    ) {
      throw new Error(
        "A solicitação de suporte original não está mais disponível para reprocessamento."
      );
    }
    throw new Error(
      "A mensagem não está elegível para reprocessamento manual."
    );
  }

  await client.query(
    `update certificates as certificate
     set render_status = 'pending', updated_at = now()
     from outbox_messages as message
     where message.id = $1
       and message.topic = 'certificate.render'
       and jsonb_typeof(message.payload) = 'object'
       and jsonb_typeof(message.payload -> 'certificateId') = 'string'
       and certificate.id::text = message.payload ->> 'certificateId'
       and certificate.render_status = 'failed'`,
    [messageId]
  );

  await client.query(
    `
      insert into audit_logs (actor_user_id, action, target_type, target_id, metadata)
      values ($1, 'outbox.requeued', 'outbox_message', $2, jsonb_build_object('reason', $3::text))
    `,
    [actorUserId, messageId, reason]
  );
};

export const supersedeUnavailableSupportDeadLetter = async ({
  actorUserId,
  client,
  messageId,
}: {
  actorUserId: string;
  client: OutboxQueryClient;
  messageId: string;
}): Promise<void> => {
  const superseded = await client.query<{ id: string }>(
    `
      update outbox_messages
      set status = 'superseded',
          superseded_at = now(),
          delivered_at = null,
          locked_at = null,
          locked_by = null,
          last_error_code = 'support_request_unavailable',
          last_error_at = now(),
          updated_at = now()
      where id = $1
        and status = 'dead_letter'
        and topic = 'email.support-request'
        and aggregate_type = 'support_request'
        and jsonb_typeof(payload) = 'object'
        and payload ->> 'requestId' = aggregate_id
        and not exists (
          select 1
          from support_requests
          where outbox_messages.aggregate_type = 'support_request'
            and support_requests.id::text = outbox_messages.aggregate_id
        )
      returning id
    `,
    [messageId]
  );

  if (!superseded.rows[0]) {
    throw new Error(
      "A mensagem não está elegível para encerramento sem reprocessamento."
    );
  }

  await client.query(
    `
      insert into audit_logs (actor_user_id, action, target_type, target_id, metadata)
      values ($1, 'outbox.superseded', 'outbox_message', $2, jsonb_build_object('reason', $3::text))
    `,
    [actorUserId, messageId, "support_request_unavailable"]
  );
};

export const supersedeUnavailableSupportDeadLetterMessage = async ({
  actorUserId,
  messageId,
}: {
  actorUserId: string;
  messageId: string;
}): Promise<void> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await supersedeUnavailableSupportDeadLetter({
      actorUserId,
      client,
      messageId,
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const reprocessOutboxDeadLetter = async ({
  actorUserId,
  messageId,
  reason,
}: {
  actorUserId: string;
  messageId: string;
  reason: string;
}): Promise<void> => {
  if (!reason.trim()) {
    throw new Error("Informe o motivo para reprocessar a mensagem.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await requeueDeadLetterMessage({
      actorUserId,
      client,
      messageId,
      reason: reason.trim(),
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export interface OutboxDeadLetterMessage {
  attempts: number;
  canReprocess: boolean;
  createdAt: Date;
  id: string;
  lastErrorAt: Date | null;
  lastErrorCode: string | null;
  reprocessBlockedReason: OutboxReprocessBlockedReason | null;
  topic: string;
}

export type OutboxReprocessBlockedReason =
  | "manual_reprocess_already_used"
  | "support_request_unavailable";

export interface OutboxDeadLetterPage {
  hasNextPage: boolean;
  messages: OutboxDeadLetterMessage[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export const listOutboxDeadLetters = async ({
  page = 1,
  pageSize = 20,
}: {
  page?: number;
  pageSize?: number;
} = {}): Promise<OutboxDeadLetterPage> => {
  const normalizedPage = Number.isFinite(page)
    ? Math.min(1000, Math.max(1, Math.trunc(page)))
    : 1;
  const normalizedPageSize = Number.isFinite(pageSize)
    ? Math.min(100, Math.max(1, Math.trunc(pageSize)))
    : 20;
  const result = await getPool().query<{
    attempts: number;
    can_reprocess: boolean;
    created_at: Date;
    id: string;
    last_error_at: Date | null;
    last_error_code: string | null;
    manual_reprocess_count: number;
    reprocess_blocked_reason: OutboxReprocessBlockedReason | null;
    topic: string;
    total_count: number;
  }>(
    `
      select id, topic, attempts, last_error_code, last_error_at, created_at,
             manual_reprocess_count,
             case
               when manual_reprocess_count = 0 and (
                 topic <> 'email.support-request'
                 or exists (
                   select 1
                   from support_requests
                   where outbox_messages.aggregate_type = 'support_request'
                     and support_requests.id::text = outbox_messages.aggregate_id
                 )
               ) then true
               else false
             end as can_reprocess,
             case
               when manual_reprocess_count > 0 then 'manual_reprocess_already_used'
               when topic = 'email.support-request' and not exists (
                 select 1
                 from support_requests
                 where outbox_messages.aggregate_type = 'support_request'
                   and support_requests.id::text = outbox_messages.aggregate_id
               ) then 'support_request_unavailable'
               else null
             end as reprocess_blocked_reason,
             count(*) over()::int as total_count
      from outbox_messages
      where status = 'dead_letter'
      order by last_error_at desc nulls last, created_at desc
      limit $1 offset $2
    `,
    [normalizedPageSize + 1, (normalizedPage - 1) * normalizedPageSize]
  );
  let totalCount = result.rows[0]?.total_count ?? 0;
  if (result.rows.length === 0 && normalizedPage > 1) {
    const countResult = await getPool().query<{ total_count: number }>(
      "select count(*)::int as total_count from outbox_messages where status = 'dead_letter'"
    );
    totalCount = countResult.rows[0]?.total_count ?? 0;
  }

  return {
    hasNextPage: result.rows.length > normalizedPageSize,
    messages: result.rows.slice(0, normalizedPageSize).map((row) => ({
      attempts: row.attempts,
      canReprocess: row.can_reprocess,
      createdAt: row.created_at,
      id: row.id,
      lastErrorAt: row.last_error_at,
      lastErrorCode: row.last_error_code,
      reprocessBlockedReason: row.reprocess_blocked_reason,
      topic: row.topic,
    })),
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalCount,
  };
};

export const pruneOutboxRecords = async (): Promise<{
  deadLetters: number;
  delivered: number;
  reprocessAudits: number;
  superseded: number;
}> => {
  const [delivered, deadLetters, superseded, reprocessAudits] =
    await Promise.all([
      getPool().query(
        `
        delete from outbox_messages
        where status = 'delivered'
          and delivered_at < now() - interval '30 days'
      `
      ),
      getPool().query(
        `
        delete from outbox_messages
        where status = 'dead_letter'
          and last_error_at < now() - interval '180 days'
      `
      ),
      getPool().query(
        `
        delete from outbox_messages
        where status = 'superseded'
          and superseded_at < now() - interval '30 days'
      `
      ),
      getPool().query(
        `
        delete from audit_logs
        where action in ('outbox.requeued', 'outbox.superseded')
          and created_at < now() - interval '180 days'
      `
      ),
    ]);

  return {
    deadLetters: deadLetters.rowCount ?? 0,
    delivered: delivered.rowCount ?? 0,
    reprocessAudits: reprocessAudits.rowCount ?? 0,
    superseded: superseded.rowCount ?? 0,
  };
};
