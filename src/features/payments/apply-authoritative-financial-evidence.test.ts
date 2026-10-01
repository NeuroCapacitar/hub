import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  applyPaidWebhookAccess: vi.fn(),
  enqueueOutboxMessage: vi.fn(),
  resolveLocalOrderIdentity: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/enrollments/server", () => ({
  applyPaidWebhookAccess: dependencies.applyPaidWebhookAccess,
}));
vi.mock("@/features/outbox/server", () => ({
  enqueueOutboxMessage: dependencies.enqueueOutboxMessage,
}));
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

const createPaidClient = (emailVerified = true) => {
  const query = vi.fn((statement: string) => {
    if (statement.includes("with transitioned as")) {
      return { rows: [{ id: "order-1" }] };
    }
    if (statement.includes("from purchase_confirmation_intents")) {
      return { rows: [] };
    }
    if (statement.includes("from outbox_messages as message")) {
      return { rows: [] };
    }
    if (
      statement.includes("from users") &&
      statement.includes("select email, name")
    ) {
      return {
        rows: [
          {
            email: "student@example.test",
            email_verified: emailVerified,
            name: "Student",
          },
        ],
      };
    }
    if (statement.includes("set customer_email = coalesce")) {
      return {
        rows: [
          {
            customer_email: "student@example.test",
            customer_name: "Student",
          },
        ],
      };
    }
    if (statement.includes("insert into account_email_challenges")) {
      return { rows: [{ generation: 1, id: "purchase-challenge" }] };
    }
    if (statement.includes("insert into purchase_confirmation_intents")) {
      return { rows: [{ order_id: "order-1" }] };
    }
    return { rows: [] };
  });
  return { query };
};

describe("authoritative financial evidence application", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.resolveLocalOrderIdentity.mockResolvedValue({
      emailVerified: true,
      userId: "user-1",
    });
  });

  it("does not grant when the paid transition is blocked by a pending review", async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };

    await expect(
      applyConfirmedPaymentAccess({ client: client as never, order })
    ).resolves.toBe(false);

    expect(dependencies.resolveLocalOrderIdentity).not.toHaveBeenCalled();
    expect(dependencies.applyPaidWebhookAccess).not.toHaveBeenCalled();
    expect(dependencies.enqueueOutboxMessage).not.toHaveBeenCalled();
  });

  it("applies access and an idempotent outbox message after financial convergence", async () => {
    const client = createPaidClient();

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
        idempotencyKey: "email.purchase-confirmed/order-1/v1",
      }),
    });
    expect(dependencies.resolveLocalOrderIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({ userId: "user-1" }),
      })
    );
  });

  it("defers the purchase verification decision and challenge to delivery", async () => {
    const client = createPaidClient(false);

    await expect(
      applyConfirmedPaymentAccess({ client: client as never, order })
    ).resolves.toBe(true);

    expect(
      client.query.mock.calls.some(([statement]) =>
        String(statement).includes("account_email_challenges")
      )
    ).toBe(false);
    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledWith({
      client,
      message: expect.objectContaining({
        idempotencyKey: "email.purchase-confirmed/order-1/v1",
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
