import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  consumeEmailChangeToken: vi.fn(),
  createCorrelationId: vi.fn(),
  logOperationalEvent: vi.fn(),
  scheduleOutboxDrainAfterResponse: vi.fn(),
}));

vi.mock("@/features/account/email-change", () => ({
  consumeEmailChangeToken: dependencies.consumeEmailChangeToken,
}));
vi.mock("@/features/outbox/background-drain", () => ({
  scheduleOutboxDrainAfterResponse:
    dependencies.scheduleOutboxDrainAfterResponse,
}));
vi.mock("@/lib/observability", () => ({
  CORRELATION_ID_HEADER: "x-correlation-id",
  createCorrelationId: dependencies.createCorrelationId,
  logOperationalEvent: dependencies.logOperationalEvent,
}));

import { POST } from "./route";

const makeRequest = (body: unknown): Request =>
  new Request("https://hub.example.test/api/account/email-changes/consume", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

describe("POST /api/account/email-changes/consume", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.createCorrelationId.mockReturnValue(
      "email-change-correlation"
    );
  });

  it("drains the outbox after a new proof transition enqueues the next email", async () => {
    dependencies.consumeEmailChangeToken.mockResolvedValue({
      nextPath: "/confirmar-troca-email?status=awaiting-new",
      outboxDrainRequired: true,
    });

    const response = await POST(makeRequest({ token: "current-email-proof" }));

    expect(dependencies.scheduleOutboxDrainAfterResponse).toHaveBeenCalledWith({
      correlationId: "email-change-correlation",
    });
    await expect(response.json()).resolves.toEqual({
      nextPath: "/confirmar-troca-email?status=awaiting-new",
      status: "confirmed",
    });
  });

  it("does not schedule another drain when a confirmation is an idempotent replay", async () => {
    dependencies.consumeEmailChangeToken.mockResolvedValue({
      nextPath: "/confirmar-troca-email?status=awaiting-new",
      outboxDrainRequired: false,
    });

    const response = await POST(makeRequest({ token: "replayed-proof" }));

    expect(response.status).toBe(200);
    expect(
      dependencies.scheduleOutboxDrainAfterResponse
    ).not.toHaveBeenCalled();
  });

  it("keeps a committed confirmation successful when immediate drain scheduling fails", async () => {
    dependencies.consumeEmailChangeToken.mockResolvedValue({
      nextPath: "/confirmar-troca-email?status=awaiting-new",
      outboxDrainRequired: true,
    });
    dependencies.scheduleOutboxDrainAfterResponse.mockImplementation(() => {
      throw new Error("request lifecycle ended");
    });

    const response = await POST(makeRequest({ token: "current-email-proof" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "confirmed",
    });
    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: "email-change-correlation",
        errorCode: "email_change_outbox_drain_schedule_failed",
        operation: "auth.email_change_confirmation_outbox_drain",
        outcome: "failure",
      })
    );
  });
});
