import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dependencies = vi.hoisted(() => ({
  getAdminOperationsData: vi.fn(),
  getJmvstreamHealthSummary: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("@/features/admin/server", () => ({
  getAdminOperationsData: dependencies.getAdminOperationsData,
}));
vi.mock("@/features/jmvstream/server", () => ({
  getJmvstreamHealthSummary: dependencies.getJmvstreamHealthSummary,
}));
vi.mock("@/features/jmvstream/portal", () => ({
  JMVSTREAM_PORTAL_URL: "https://hub.jmvtechnology.com",
}));
vi.mock("@/features/operations/server", () => ({}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));
vi.mock("./outbox-dead-letter-dialog", () => ({
  OutboxDeadLetterDialog: () => <button type="button">Detalhes</button>,
}));
vi.mock("./webhook-recovery-dialog", () => ({
  WebhookRecoveryDialog: () => <button type="button">Detalhes</button>,
}));

import AdminOperationsPage from "./page";

dependencies.requirePermission.mockResolvedValue({
  role: "admin",
  supportPermissionGrants: [],
});

const emptyBacklog = {
  alerts: [],
  emailDelivery: {
    accepted: 5,
    bounced: 0,
    complained: 0,
    delivered: 4,
    resendWebhook: {
      deadLetters: 0,
      oldestDeadLetterAt: null,
      oldestRetryAt: null,
      retrying: 0,
    },
  },
  outbox: {
    deadLetters: 0,
    oldestReadyAt: null,
    ready: 0,
    superseded: 0,
  },
  payments: {
    uncertainCheckouts: 0,
    uncertainRefunds: 0,
    uncorrelatedOrders: 0,
  },
  videos: { oldestPendingAt: null, pending: 0 },
  webhooks: {
    failed: 0,
    oldestFailedAt: null,
    oldestReadyAt: null,
    oldestRetryAt: null,
    ready: 0,
    retryable: 0,
  },
};

describe("AdminOperationsPage", () => {
  it("keeps operational queues and recovery actions together", async () => {
    dependencies.getJmvstreamHealthSummary.mockResolvedValue({
      auth: "ok",
      failedDeletes: 2,
      failedUploads: 1,
      folderCount: 8,
      message: "JMVStream autenticada e galerias acessíveis.",
      orphanFolders: 1,
      pendingDeletes: 3,
      processingUploads: 4,
    });
    dependencies.getAdminOperationsData.mockResolvedValue({
      canRetryOutbox: true,
      canRetryWebhook: true,
      operationalBacklog: {
        ...emptyBacklog,
        alerts: [{ code: "outbox_dead_letter", severity: "critical" }],
        outbox: {
          ...emptyBacklog.outbox,
          deadLetters: 1,
        },
      },
      outboxDeadLetters: {
        hasNextPage: false,
        messages: [
          {
            attempts: 5,
            createdAt: new Date("2026-09-07T12:00:00Z"),
            id: "message-1",
            lastErrorAt: new Date("2026-09-07T12:30:00Z"),
            lastErrorCode: "delivery_failed",
            topic: "email.certificate-issued",
          },
        ],
        page: 1,
        pageSize: 20,
        totalCount: 1,
      },
      resendWebhookDeadLetters: {
        events: [],
        hasNextPage: false,
        page: 1,
        pageSize: 20,
        totalCount: 0,
      },
      webhookEvents: {
        events: [],
        hasNextPage: false,
        page: 1,
        pageSize: 20,
        search: "",
        totalCount: 0,
      },
    });

    const markup = renderToStaticMarkup(
      await AdminOperationsPage({
        searchParams: Promise.resolve({}),
      })
    );

    expect(markup).toContain("Operações e recuperação");
    expect(markup).toContain("Alertas operacionais");
    expect(markup).toContain("Mensagens em dead letter");
    expect(markup).toContain("Detalhes");
    expect(markup).toContain("Nenhum webhook para recuperar");
    expect(markup).toContain("Saúde da JMVStream");
    expect(markup).toContain("Conectada");
    expect(markup).toContain("Uploads com falha");
    expect(markup).toContain("Abrir portal JMVStream");
    expect(markup).toContain("Abrir cursos");
    expect(markup).toContain("Abrir Financeiro");
    expect(markup).not.toContain("Alterações administrativas recentes");
  });

  it("shows the Resend dead-letter queue separately from the Outbox", async () => {
    dependencies.getJmvstreamHealthSummary.mockResolvedValue({
      auth: "ok",
      failedDeletes: 0,
      failedUploads: 0,
      folderCount: 0,
      message: "JMVStream conectada e galerias acessíveis.",
      orphanFolders: 0,
      pendingDeletes: 0,
      processingUploads: 0,
    });
    dependencies.getAdminOperationsData.mockResolvedValue({
      canRetryOutbox: true,
      canRetryWebhook: true,
      operationalBacklog: {
        ...emptyBacklog,
        alerts: [{ code: "email_delivery_dead_letter", severity: "high" }],
        emailDelivery: {
          ...emptyBacklog.emailDelivery,
          resendWebhook: {
            ...emptyBacklog.emailDelivery.resendWebhook,
            deadLetters: 1,
            oldestDeadLetterAt: new Date("2026-09-01T12:00:00Z"),
          },
        },
      },
      outboxDeadLetters: {
        hasNextPage: false,
        messages: [],
        page: 1,
        pageSize: 20,
        totalCount: 0,
      },
      resendWebhookDeadLetters: {
        events: [
          {
            attempts: 12,
            correlationId: "0198d6f4-c2a5-7000-8000-000000000001",
            eventType: "email.delivered",
            id: "0198d6f4-c2a5-7000-8000-000000000002",
            lastErrorCode: "email_message_unresolved",
            occurredAt: new Date("2026-09-01T12:00:00Z"),
            providerEventId: "svix-event-1",
            providerMessageId: "resend-message-1",
            receivedAt: new Date("2026-09-01T12:00:01Z"),
            updatedAt: new Date("2026-09-02T12:00:00Z"),
          },
        ],
        hasNextPage: false,
        page: 1,
        pageSize: 20,
        totalCount: 1,
      },
      webhookEvents: {
        events: [],
        hasNextPage: false,
        page: 1,
        pageSize: 20,
        search: "",
        totalCount: 0,
      },
    });

    const markup = renderToStaticMarkup(
      await AdminOperationsPage({
        searchParams: Promise.resolve({}),
      })
    );

    expect(markup).toContain("Eventos Resend em dead letter");
    expect(markup).toContain("email_message_unresolved");
    expect(markup).toContain('href="#resend-webhooks"');
    expect(markup).toContain('href="https://resend.com/webhooks"');
    expect(markup).not.toContain("Mensagem em dead letter");
  });
});
