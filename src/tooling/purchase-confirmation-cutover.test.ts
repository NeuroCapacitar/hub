import type { PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ enqueueOutboxMessage: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/features/outbox/server", () => ({
  enqueueOutboxMessage: dependencies.enqueueOutboxMessage,
}));

import {
  resolvePurchaseConfirmationCutoverTarget,
  runPurchaseConfirmationLegacyCutover,
} from "./purchase-confirmation-cutover";

const directDatabaseUrl =
  "postgresql://operator:secret@dev.example.neon.tech/hub?sslmode=verify-full";

const environment = {
  DATABASE_URL_DIRECT: directDatabaseUrl,
  DEVELOPMENT_DATABASE_HOST: "dev.example.neon.tech",
};

const makeClient = (
  respond: (statement: string) => { rows: unknown[] } = () => ({ rows: [] })
): { client: PoolClient; query: ReturnType<typeof vi.fn> } => {
  const query = vi.fn(async (statement: string) =>
    respond(statement)
  ) as unknown as PoolClient["query"];
  return {
    client: { query } as unknown as PoolClient,
    query: query as ReturnType<typeof vi.fn>,
  };
};

describe("purchase confirmation legacy cutover", () => {
  it("accepts an explicitly scoped dry run without requiring the new template gate", () => {
    const target = resolvePurchaseConfirmationCutoverTarget({
      argv: ["--environment=development", "--dry-run"],
      environment,
    });

    expect(target).toMatchObject({
      environment: "development",
      mode: "dry-run",
    });
    expect(new URL(target.databaseUrl).searchParams.get("sslmode")).toBe(
      "verify-full"
    );
  });

  it("requires explicit execution confirmation and a published template", () => {
    expect(() =>
      resolvePurchaseConfirmationCutoverTarget({
        argv: ["--environment=development", "--execute"],
        environment: {
          ...environment,
          PURCHASE_CONFIRMATION_CUTOVER_CONFIRMATION:
            "REPLACE_UNACCEPTED_PURCHASE_CONFIRMATION_V1",
        },
      })
    ).toThrow("PURCHASE_CONFIRMED_TEMPLATE_PUBLISHED");

    expect(() =>
      resolvePurchaseConfirmationCutoverTarget({
        argv: ["--environment=development", "--execute"],
        environment: {
          ...environment,
          PURCHASE_CONFIRMED_TEMPLATE_PUBLISHED: "true",
        },
      })
    ).toThrow("PURCHASE_CONFIRMATION_CUTOVER_CONFIRMATION");
  });

  it("rejects pooled or environment-mismatched database URLs", () => {
    expect(() =>
      resolvePurchaseConfirmationCutoverTarget({
        argv: ["--environment=development", "--dry-run"],
        environment: {
          ...environment,
          DATABASE_URL_DIRECT:
            "postgresql://operator:secret@dev-pooler.example.neon.tech/hub?sslmode=verify-full",
        },
      })
    ).toThrow("verified direct PostgreSQL URL");

    expect(() =>
      resolvePurchaseConfirmationCutoverTarget({
        argv: ["--environment=development", "--dry-run"],
        environment: {
          ...environment,
          DEVELOPMENT_DATABASE_HOST: "another.example.neon.tech",
        },
      })
    ).toThrow("does not match the declared environment");
  });

  it("keeps dry-run read-only and reports eligibility without loading candidates", async () => {
    const { client, query } = makeClient((statement) => {
      if (statement.includes("to_regclass")) {
        return { rows: [{ schema_ready: true }] };
      }
      if (statement.includes("from per_order")) {
        return {
          rows: [
            {
              ambiguous: 2,
              eligible: 3,
              in_flight: 1,
              total: 5,
            },
          ],
        };
      }
      return { rows: [] };
    });

    await expect(
      runPurchaseConfirmationLegacyCutover({
        client,
        mode: "dry-run",
      })
    ).resolves.toMatchObject({
      ambiguousLegacy: 2,
      eligible: 3,
      enqueued: 0,
      inFlightLegacy: 1,
      processed: 0,
      remaining: 5,
    });
    expect(query).toHaveBeenCalledWith(
      "begin isolation level repeatable read read only"
    );
    expect(query).toHaveBeenCalledWith("rollback");
    expect(
      query.mock.calls.some(([statement]) =>
        String(statement).includes("select distinct orders.id")
      )
    ).toBe(false);
    expect(
      query.mock.calls.some(([statement]) => String(statement) === "commit")
    ).toBe(false);
  });

  it("reconciles one batch atomically and leaves ambiguous legacy deliveries alone", async () => {
    let countReads = 0;
    const { client, query } = makeClient((statement) => {
      if (statement.includes("to_regclass")) {
        return { rows: [{ schema_ready: true }] };
      }
      if (statement.includes("from per_order")) {
        countReads += 1;
        return {
          rows: [
            {
              ambiguous: countReads === 1 ? 1 : 1,
              eligible: countReads === 1 ? 1 : 0,
              in_flight: 1,
              total: countReads === 1 ? 2 : 1,
            },
          ],
        };
      }
      if (statement.includes("select distinct orders.id")) {
        return {
          rows: [{ order_id: "order-1", user_id: "user-1" }],
        };
      }
      return { rows: [] };
    });
    const replaceLegacy = vi.fn(async () => "enqueued" as const);

    await expect(
      runPurchaseConfirmationLegacyCutover({
        client,
        mode: "execute",
        replaceLegacy,
      })
    ).resolves.toMatchObject({
      ambiguousLegacy: 0,
      enqueued: 1,
      eligible: 1,
      inFlightLegacy: 1,
      processed: 1,
      remaining: 1,
    });
    expect(replaceLegacy).toHaveBeenCalledWith({
      client,
      orderId: "order-1",
      replaceHistorical: true,
      userId: "user-1",
    });
    expect(query).toHaveBeenCalledWith("commit");
  });

  it("rolls back when schema prerequisites are missing", async () => {
    const { client, query } = makeClient((statement) => {
      if (statement.includes("to_regclass")) {
        return { rows: [{ schema_ready: false }] };
      }
      return { rows: [] };
    });

    await expect(
      runPurchaseConfirmationLegacyCutover({
        client,
        mode: "dry-run",
      })
    ).rejects.toThrow("Migration 0098 is not applied");
    expect(query).toHaveBeenCalledWith("rollback");
  });
});
