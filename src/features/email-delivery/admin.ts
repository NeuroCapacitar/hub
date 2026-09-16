import "server-only";
import { getPool } from "@/db";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_PAGE = 1000;

export interface ResendWebhookDeadLetter {
  attempts: number;
  correlationId: string | null;
  eventType: string;
  id: string;
  lastErrorCode: string | null;
  occurredAt: Date;
  providerEventId: string;
  providerMessageId: string | null;
  receivedAt: Date;
  updatedAt: Date;
}

export interface ResendWebhookDeadLetterPage {
  events: ResendWebhookDeadLetter[];
  hasNextPage: boolean;
  page: number;
  pageSize: number;
  totalCount: number;
}

export const listResendWebhookDeadLetters = async ({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  page?: number;
  pageSize?: number;
} = {}): Promise<ResendWebhookDeadLetterPage> => {
  const normalizedPage = Number.isFinite(page)
    ? Math.min(MAX_PAGE, Math.max(1, Math.trunc(page)))
    : 1;
  const normalizedPageSize = Number.isFinite(pageSize)
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize)))
    : DEFAULT_PAGE_SIZE;
  const result = await getPool().query<{
    attempts: number;
    correlation_id: string | null;
    event_type: string;
    id: string;
    last_error_code: string | null;
    occurred_at: Date;
    provider_event_id: string;
    provider_message_id: string | null;
    received_at: Date;
    total_count: number;
    updated_at: Date;
  }>(
    `
      select
        id,
        provider_event_id,
        provider_message_id,
        correlation_id,
        event_type,
        occurred_at,
        received_at,
        attempts,
        last_error_code,
        updated_at,
        count(*) over()::int as total_count
      from resend_webhook_events
      where status = 'dead_letter'
      order by updated_at desc, occurred_at desc, id desc
      limit $1 offset $2
    `,
    [normalizedPageSize + 1, (normalizedPage - 1) * normalizedPageSize]
  );

  let totalCount = result.rows[0]?.total_count ?? 0;
  if (result.rows.length === 0 && normalizedPage > 1) {
    const countResult = await getPool().query<{ total_count: number }>(
      "select count(*)::int as total_count from resend_webhook_events where status = 'dead_letter'"
    );
    totalCount = countResult.rows[0]?.total_count ?? 0;
  }

  return {
    events: result.rows.slice(0, normalizedPageSize).map((row) => ({
      attempts: row.attempts,
      correlationId: row.correlation_id,
      eventType: row.event_type,
      id: row.id,
      lastErrorCode: row.last_error_code,
      occurredAt: row.occurred_at,
      providerEventId: row.provider_event_id,
      providerMessageId: row.provider_message_id,
      receivedAt: row.received_at,
      updatedAt: row.updated_at,
    })),
    hasNextPage: result.rows.length > normalizedPageSize,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalCount,
  };
};
