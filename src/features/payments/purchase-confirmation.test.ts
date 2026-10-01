import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ enqueueOutboxMessage: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/features/outbox/server", () => ({
  enqueueOutboxMessage: dependencies.enqueueOutboxMessage,
}));

import { enqueuePurchaseConfirmedEmail } from "./purchase-confirmation";

const makeClient = (
  handleQuery: (statement: string, values: unknown[]) => unknown
) => {
  const query = vi.fn(async (statement: string, values: unknown[] = []) =>
    handleQuery(statement, values)
  );
  return { client: { query }, query };
};

describe("purchase confirmation intent", () => {
  beforeEach(() => {
    dependencies.enqueueOutboxMessage.mockReset();
    dependencies.enqueueOutboxMessage.mockResolvedValue({
      id: "outbox-purchase",
      inserted: true,
    });
  });

  it("registers one durable intent and adds an order-bound verification challenge when needed", async () => {
    const orderId = "order-1";
    const userId = "student-1";
    const { client, query } = makeClient((statement) => {
      if (statement.includes("from purchase_confirmation_intents")) {
        return { rows: [] };
      }
      if (statement.includes("from outbox_messages as message")) {
        return { rows: [] };
      }
      if (
        statement.includes("from users") &&
        statement.includes("email_verified")
      ) {
        return {
          rows: [
            {
              email: "student@example.test",
              email_verified: false,
              name: "Student",
            },
          ],
        };
      }
      if (statement.includes("update orders")) {
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
        return { rows: [{ generation: 1, id: "challenge-1" }] };
      }
      if (statement.includes("insert into purchase_confirmation_intents")) {
        return { rows: [{ order_id: orderId }] };
      }
      return { rows: [] };
    });

    await expect(
      enqueuePurchaseConfirmedEmail({
        client: client as never,
        orderId,
        userId,
      })
    ).resolves.toBe("enqueued");

    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledWith({
      client,
      message: {
        aggregateId: orderId,
        aggregateType: "order",
        idempotencyKey: "email.purchase-confirmed/order-1/v1",
        payload: { orderId, userId },
        payloadVersion: 1,
        topic: "email.purchase-confirmed",
      },
    });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("insert into account_email_challenges"),
      expect.arrayContaining([orderId, userId])
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("verification_required"),
      [orderId, true]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("update orders"),
      [orderId, "student@example.test", "Student", userId]
    );
  });

  it("does not create a second email when the durable per-order marker exists", async () => {
    const { client, query } = makeClient((statement) => {
      if (statement.includes("from purchase_confirmation_intents")) {
        return { rows: [{ origin: "current" }] };
      }
      return { rows: [] };
    });

    await expect(
      enqueuePurchaseConfirmedEmail({
        client: client as never,
        orderId: "order-1",
        userId: "student-1",
      })
    ).resolves.toBe("already_registered");

    expect(query).toHaveBeenCalledOnce();
    expect(dependencies.enqueueOutboxMessage).not.toHaveBeenCalled();
  });

  it("does not resend a paid order whose outbox history has already been pruned", async () => {
    const { client, query } = makeClient((statement) => {
      if (statement.includes("from purchase_confirmation_intents")) {
        return { rows: [{ origin: "historical" }] };
      }
      return { rows: [] };
    });

    await expect(
      enqueuePurchaseConfirmedEmail({
        client: client as never,
        orderId: "order-1",
        userId: "student-1",
      })
    ).resolves.toBe("already_registered");

    expect(query).toHaveBeenCalledOnce();
    expect(dependencies.enqueueOutboxMessage).not.toHaveBeenCalled();
  });

  it("preserves a legacy in-flight or accepted email instead of sending a second version", async () => {
    const { client, query } = makeClient((statement) => {
      if (statement.includes("from purchase_confirmation_intents")) {
        return { rows: [] };
      }
      if (statement.includes("from outbox_messages as message")) {
        return {
          rows: [
            {
              email_status: "acceptance_unknown",
              id: "legacy-message",
              status: "retrying",
              topic: "auth.account-activation",
            },
          ],
        };
      }
      if (statement.includes("insert into purchase_confirmation_intents")) {
        return { rows: [{ order_id: "order-1" }] };
      }
      return { rows: [] };
    });

    await expect(
      enqueuePurchaseConfirmedEmail({
        client: client as never,
        orderId: "order-1",
        userId: "student-1",
      })
    ).resolves.toBe("legacy_satisfied");

    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("select email_verified from users"),
      expect.anything()
    );
    expect(dependencies.enqueueOutboxMessage).not.toHaveBeenCalled();
  });

  it("supersedes an unaccepted legacy intent before enqueueing the replacement", async () => {
    const { client, query } = makeClient((statement) => {
      if (statement.includes("from purchase_confirmation_intents")) {
        return { rows: [] };
      }
      if (statement.includes("from outbox_messages as message")) {
        return {
          rows: [
            {
              email_status: "failed",
              id: "legacy-message",
              status: "dead_letter",
              topic: "email.access-released",
            },
          ],
        };
      }
      if (
        statement.includes("from users") &&
        statement.includes("email_verified")
      ) {
        return {
          rows: [
            {
              email: "student@example.test",
              email_verified: true,
              name: "Student",
            },
          ],
        };
      }
      if (statement.includes("update orders")) {
        return {
          rows: [
            {
              customer_email: "student@example.test",
              customer_name: "Student",
            },
          ],
        };
      }
      if (statement.includes("update outbox_messages")) {
        return { rows: [{ id: "legacy-message" }] };
      }
      if (statement.includes("insert into purchase_confirmation_intents")) {
        return { rows: [{ order_id: "order-1" }] };
      }
      return { rows: [] };
    });

    await expect(
      enqueuePurchaseConfirmedEmail({
        client: client as never,
        orderId: "order-1",
        userId: "student-1",
      })
    ).resolves.toBe("enqueued");

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("set status = 'superseded'"),
      ["legacy-message", "purchase_confirmation_replaced"]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into audit_logs"),
      [
        "legacy-message",
        JSON.stringify({ reason: "purchase_confirmation_replaced" }),
      ]
    );
    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledOnce();
  });

  it("replaces only a historical legacy message explicitly selected by the rollout", async () => {
    const { client, query } = makeClient((statement) => {
      if (statement.includes("from purchase_confirmation_intents")) {
        return { rows: [{ origin: "historical" }] };
      }
      if (statement.includes("from outbox_messages as message")) {
        return {
          rows: [
            {
              email_status: "failed",
              id: "legacy-message",
              status: "retrying",
              topic: "auth.account-activation",
            },
          ],
        };
      }
      if (
        statement.includes("from users") &&
        statement.includes("email_verified")
      ) {
        return {
          rows: [
            {
              email: "student@example.test",
              email_verified: true,
              name: "Student",
            },
          ],
        };
      }
      if (statement.includes("update orders")) {
        return {
          rows: [
            {
              customer_email: "student@example.test",
              customer_name: "Student",
            },
          ],
        };
      }
      if (statement.includes("update purchase_confirmation_intents")) {
        return { rows: [{ order_id: "order-1" }] };
      }
      return { rows: [] };
    });

    await expect(
      enqueuePurchaseConfirmedEmail({
        client: client as never,
        orderId: "order-1",
        replaceHistorical: true,
        userId: "student-1",
      })
    ).resolves.toBe("enqueued");

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("set origin = 'current'"),
      ["order-1", false]
    );
    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledOnce();
  });
});
