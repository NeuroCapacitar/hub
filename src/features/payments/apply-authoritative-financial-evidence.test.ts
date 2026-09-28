import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  applyPaidWebhookAccess: vi.fn(),
  enqueueOutboxMessage: vi.fn(),
  getServerEnv: vi.fn(),
  resolveLocalOrderIdentity: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/enrollments/server", () => ({
  applyPaidWebhookAccess: dependencies.applyPaidWebhookAccess,
}));
vi.mock("@/features/outbox/server", () => ({
  enqueueOutboxMessage: dependencies.enqueueOutboxMessage,
}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("@/features/payments/order-identity", () => ({
  LocalOrderIdentityError: class LocalOrderIdentityError extends Error {
    readonly code: string;

    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  resolveLocalOrderIdentity: dependencies.resolveLocalOrderIdentity,
}));

import { LocalOrderIdentityError } from "@/features/payments/order-identity";
import { applyConfirmedPaymentAccess } from "./apply-authoritative-financial-evidence";

const order = {
  accessDurationMonths: 12,
  buyerIdentityStatus: "resolved",
  courseId: "course-1",
  id: "order-1",
  status: "pending",
  userId: "user-1",
} as const;

describe("authoritative financial evidence application", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getServerEnv.mockReturnValue({
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
    });
    dependencies.resolveLocalOrderIdentity.mockResolvedValue({
      activationRequired: false,
      userId: "user-1",
    });
  });

  it("does not grant when the paid transition is blocked by a pending review", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    await expect(
      applyConfirmedPaymentAccess({ client: client as never, order })
    ).resolves.toBe(false);

    expect(dependencies.resolveLocalOrderIdentity).not.toHaveBeenCalled();
    expect(dependencies.applyPaidWebhookAccess).not.toHaveBeenCalled();
    expect(dependencies.enqueueOutboxMessage).not.toHaveBeenCalled();
  });

  it("applies access and an idempotent outbox message after financial convergence", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: "order-1" }] }),
    };

    await expect(
      applyConfirmedPaymentAccess({ client: client as never, order })
    ).resolves.toBe(true);

    expect(dependencies.applyPaidWebhookAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        accessDurationMonths: 12,
        courseId: "course-1",
        orderId: "order-1",
        userId: "user-1",
      })
    );
    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledWith({
      client,
      message: expect.objectContaining({
        idempotencyKey: "email.access-released/order-1/v1",
      }),
    });
    expect(dependencies.resolveLocalOrderIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ googleProviderEnabled: false })
    );
  });

  it("uses the enabled Google provider when deciding whether paid access needs email activation", async () => {
    dependencies.getServerEnv.mockReturnValue({
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
    });
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: "order-1" }] }),
    };

    await expect(
      applyConfirmedPaymentAccess({ client: client as never, order })
    ).resolves.toBe(true);

    expect(dependencies.resolveLocalOrderIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ googleProviderEnabled: true })
    );
    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledWith({
      client,
      message: expect.objectContaining({
        idempotencyKey: "email.access-released/order-1/v1",
      }),
    });
  });

  it("turns an ambiguous original/canonical email match into identity review without granting access", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: "order-1" }] }),
    };
    const onIdentityReview = vi.fn();
    dependencies.resolveLocalOrderIdentity.mockRejectedValue(
      new LocalOrderIdentityError("order_identity_conflict")
    );

    await expect(
      applyConfirmedPaymentAccess({
        client: client as never,
        onIdentityReview,
        order,
      })
    ).resolves.toBe(false);

    expect(onIdentityReview).toHaveBeenCalledWith("buyer_identity_conflict");
    expect(dependencies.applyPaidWebhookAccess).not.toHaveBeenCalled();
    expect(dependencies.enqueueOutboxMessage).not.toHaveBeenCalled();
  });
});
