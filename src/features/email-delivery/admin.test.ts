import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ getPool: vi.fn() }));

vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("server-only", () => ({}));

import { listResendWebhookDeadLetters } from "./admin";

describe("Resend webhook administrative read model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({ rows: [] }),
    });
  });

  it("lists only Resend events in dead letter without payload", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          attempts: 12,
          correlation_id: "0198d6f4-c2a5-7000-8000-000000000001",
          event_type: "email.delivered",
          id: "0198d6f4-c2a5-7000-8000-000000000002",
          last_error_code: "email_message_unresolved",
          occurred_at: new Date("2026-09-01T12:00:00.000Z"),
          provider_event_id: "svix-event-1",
          provider_message_id: "resend-message-1",
          received_at: new Date("2026-09-01T12:00:01.000Z"),
          total_count: 1,
          updated_at: new Date("2026-09-02T12:00:00.000Z"),
        },
      ],
    });
    dependencies.getPool.mockReturnValue({ query });

    await expect(listResendWebhookDeadLetters()).resolves.toEqual({
      events: [
        {
          attempts: 12,
          correlationId: "0198d6f4-c2a5-7000-8000-000000000001",
          eventType: "email.delivered",
          id: "0198d6f4-c2a5-7000-8000-000000000002",
          lastErrorCode: "email_message_unresolved",
          occurredAt: new Date("2026-09-01T12:00:00.000Z"),
          providerEventId: "svix-event-1",
          providerMessageId: "resend-message-1",
          receivedAt: new Date("2026-09-01T12:00:01.000Z"),
          updatedAt: new Date("2026-09-02T12:00:00.000Z"),
        },
      ],
      hasNextPage: false,
      page: 1,
      pageSize: 20,
      totalCount: 1,
    });

    expect(String(query.mock.calls[0]?.[0])).toContain(
      "from resend_webhook_events"
    );
    expect(String(query.mock.calls[0]?.[0])).toContain(
      "where status = 'dead_letter'"
    );
    expect(String(query.mock.calls[0]?.[0])).not.toContain("payload");
  });

  it("recovers the total count when a requested page is empty", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total_count: 3 }] });
    dependencies.getPool.mockReturnValue({ query });

    await expect(
      listResendWebhookDeadLetters({ page: 2 })
    ).resolves.toMatchObject({
      events: [],
      page: 2,
      totalCount: 3,
    });
    expect(query).toHaveBeenCalledTimes(2);
  });
});
