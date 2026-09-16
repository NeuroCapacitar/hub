import { describe, expect, it, vi } from "vitest";
import { createCertificateIssuedMessage } from "./rules";

const dependencies = vi.hoisted(() => ({ getPool: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));

import {
  claimOutboxMessages,
  enqueueOutboxMessage,
  listOutboxDeadLetters,
  markOutboxMessageDeadLetter,
  markOutboxMessageDeferred,
  markOutboxMessageDelivered,
  markOutboxMessageForRetry,
  markOutboxMessageSuperseded,
  pruneOutboxRecords,
  requeueDeadLetterMessage,
  supersedeUnavailableSupportDeadLetter,
} from "./server";

const SKIP_LOCKED_PATTERN = /for update skip locked/i;

describe("outbox persistence", () => {
  it("inserts a durable intent with a unique idempotency key", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: "outbox-1" }] });

    await expect(
      enqueueOutboxMessage({
        client: { query } as never,
        message: createCertificateIssuedMessage({
          certificateId: "certificate-1",
        }),
      })
    ).resolves.toEqual({ id: "outbox-1", inserted: true });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("on conflict (idempotency_key) do nothing"),
      expect.arrayContaining([
        "email.certificate-issued/certificate-1/v1",
        JSON.stringify({ certificateId: "certificate-1" }),
      ])
    );
  });

  it("claims ready messages with skip locked before delivery", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    await claimOutboxMessages({
      client: { query } as never,
      limit: 10,
      workerId: "worker-a",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(SKIP_LOCKED_PATTERN),
      ["worker-a", 10]
    );
  });

  it("defers a message without consuming a delivery attempt", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });

    await expect(
      markOutboxMessageDeferred({
        client: { query } as never,
        errorCode: "course_sales_closed",
        id: "outbox-1",
        workerId: "worker-a",
      })
    ).resolves.toBe(true);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("attempts = greatest(attempts - 1, 0)"),
      ["outbox-1", "worker-a", "course_sales_closed"]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("interval '24 hours'"),
      ["outbox-1", "worker-a", "course_sales_closed"]
    );
  });

  it.each([
    {
      mark: (query: ReturnType<typeof vi.fn>) =>
        markOutboxMessageSuperseded({
          client: { query } as never,
          errorCode: "expiry_generation_changed",
          id: "outbox-1",
          workerId: "worker-a",
        }),
      name: "superseded",
    },
    {
      mark: (query: ReturnType<typeof vi.fn>) =>
        markOutboxMessageDelivered({
          client: { query } as never,
          id: "outbox-1",
          workerId: "worker-a",
        }),
      name: "delivered",
    },
    {
      mark: (query: ReturnType<typeof vi.fn>) =>
        markOutboxMessageForRetry({
          client: { query } as never,
          errorCode: "delivery_failed",
          id: "outbox-1",
          retryDelayMs: 60_000,
          workerId: "worker-a",
        }),
      name: "retry",
    },
    {
      mark: (query: ReturnType<typeof vi.fn>) =>
        markOutboxMessageDeferred({
          client: { query } as never,
          errorCode: "course_sales_closed",
          id: "outbox-1",
          workerId: "worker-a",
        }),
      name: "deferred",
    },
    {
      mark: (query: ReturnType<typeof vi.fn>) =>
        markOutboxMessageDeadLetter({
          client: { query } as never,
          errorCode: "delivery_failed",
          id: "outbox-1",
          workerId: "worker-a",
        }),
      name: "dead letter",
    },
  ])("returns false when the $name transition loses ownership", async ({
    mark,
  }) => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });

    await expect(mark(query)).resolves.toBe(false);
    const statement = String(query.mock.calls[0]?.[0]);
    expect(statement).toContain("status = 'processing'");
    expect(statement).toContain("locked_by = $2");
    expect(query.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining(["outbox-1", "worker-a"])
    );
  });

  it("dead-letters certificate.render and fails its certificate in one fenced statement", async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ transitioned: true }],
    });

    await expect(
      markOutboxMessageDeadLetter({
        client: { query } as never,
        errorCode: "certificate_render_failed",
        id: "outbox-1",
        workerId: "worker-a",
      })
    ).resolves.toBe(true);

    const statement = String(query.mock.calls[0]?.[0]);
    expect(statement).toContain("with transitioned as");
    expect(statement).toContain("message.topic = 'certificate.render'");
    expect(statement).toContain("jsonb_typeof");
    expect(statement).toContain("certificate.id::text");
    expect(statement).not.toContain("::uuid");
    expect(statement).toContain("certificate.render_claim_token is null");
  });

  it("marks superseded as a fenced terminal state without consuming retry or delivery", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });

    await expect(
      markOutboxMessageSuperseded({
        client: { query } as never,
        errorCode: "expiry_window_elapsed",
        id: "outbox-1",
        workerId: "worker-a",
      })
    ).resolves.toBe(true);

    const statement = String(query.mock.calls[0]?.[0]);
    expect(statement).toContain("status = 'superseded'");
    expect(statement).toContain("superseded_at = now()");
    expect(statement).toContain("delivered_at = null");
    expect(statement).not.toContain("attempts =");
    expect(query.mock.calls[0]?.[1]).toEqual([
      "outbox-1",
      "worker-a",
      "expiry_window_elapsed",
    ]);
  });

  it("prunes superseded messages after thirty days separately", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 3 })
      .mockResolvedValueOnce({ rowCount: 4 })
      .mockResolvedValueOnce({ rowCount: 5 });
    dependencies.getPool.mockReturnValue({ query });

    await expect(pruneOutboxRecords()).resolves.toEqual({
      deadLetters: 3,
      delivered: 2,
      reprocessAudits: 5,
      superseded: 4,
    });
    expect(String(query.mock.calls[2]?.[0])).toContain("status = 'superseded'");
    expect(String(query.mock.calls[2]?.[0])).toContain("interval '30 days'");
  });

  it("allows exactly one manually audited reprocess", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: "outbox-1" }] })
      .mockResolvedValueOnce({ rows: [] });

    await requeueDeadLetterMessage({
      actorUserId: "admin-1",
      client: { query } as never,
      messageId: "outbox-1",
      reason: "Falha transitória confirmada.",
    });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("manual_reprocess_count = 0"),
      ["outbox-1"]
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("render_status = 'pending'"),
      ["outbox-1"]
    );
    const certificateRequeueStatement = String(query.mock.calls[1]?.[0]);
    expect(certificateRequeueStatement).toContain(
      "message.topic = 'certificate.render'"
    );
    expect(certificateRequeueStatement).toContain("jsonb_typeof");
    expect(certificateRequeueStatement).toContain("certificate.id::text");
    expect(certificateRequeueStatement).not.toContain("::uuid");
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("insert into audit_logs"),
      ["admin-1", "outbox-1", "Falha transitória confirmada."]
    );
    expect(String(query.mock.calls[2]?.[0])).toContain("$3::text");
  });

  it("does not requeue a support message after its source request is unavailable", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            manual_reprocess_count: 0,
            source_exists: false,
            status: "dead_letter",
            topic: "email.support-request",
          },
        ],
      });

    await expect(
      requeueDeadLetterMessage({
        actorUserId: "admin-1",
        client: { query } as never,
        messageId: "outbox-support-1",
        reason: "Falha transitória confirmada.",
      })
    ).rejects.toThrow(
      "A solicitação de suporte original não está mais disponível"
    );

    expect(query).toHaveBeenCalledTimes(2);
    expect(String(query.mock.calls[0]?.[0])).toContain("support_requests");
  });

  it("supersedes an unavailable support dead letter without changing attempts", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: "outbox-support-1" }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      supersedeUnavailableSupportDeadLetter({
        actorUserId: "admin-1",
        client: { query } as never,
        messageId: "outbox-support-1",
      })
    ).resolves.toBeUndefined();

    expect(String(query.mock.calls[0]?.[0])).toContain("status = 'superseded'");
    expect(String(query.mock.calls[0]?.[0])).toContain("email.support-request");
    expect(String(query.mock.calls[0]?.[0])).toContain("not exists");
    expect(String(query.mock.calls[0]?.[0])).not.toContain(
      "manual_reprocess_count = manual_reprocess_count + 1"
    );
    expect(query.mock.calls[1]?.[1]).toEqual([
      "admin-1",
      "outbox-support-1",
      "support_request_unavailable",
    ]);
  });

  it("returns support dead letters as non-reprocessable without selecting payload", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          attempts: 5,
          can_reprocess: false,
          created_at: new Date("2026-09-01T00:00:00Z"),
          id: "outbox-support-1",
          last_error_at: new Date("2026-09-02T00:00:00Z"),
          last_error_code: "aggregate_not_deliverable",
          manual_reprocess_count: 0,
          reprocess_blocked_reason: "support_request_unavailable",
          topic: "email.support-request",
          total_count: 1,
        },
      ],
    });
    dependencies.getPool.mockReturnValue({ query });

    await expect(listOutboxDeadLetters()).resolves.toMatchObject({
      messages: [
        {
          canReprocess: false,
          id: "outbox-support-1",
          reprocessBlockedReason: "support_request_unavailable",
        },
      ],
    });
    expect(String(query.mock.calls[0]?.[0])).toContain("support_requests");
    expect(String(query.mock.calls[0]?.[0])).not.toContain("select payload");
  });
});
