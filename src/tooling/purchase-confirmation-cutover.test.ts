import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ enqueueOutboxMessage: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/features/outbox/server", () => ({
  enqueueOutboxMessage: dependencies.enqueueOutboxMessage,
}));

import {
  getPurchaseConfirmationCutoverCounts,
  getPurchaseConfirmationLegacyCutoverCandidates,
  resolvePurchaseConfirmationCutoverTarget,
  runPurchaseConfirmationLegacyCutover,
} from "./purchase-confirmation-cutover";

const postgresTestUrl = process.env.CI_POSTGRES_ADMIN_URL?.trim();
if (postgresTestUrl) {
  const postgresTestHost = new URL(postgresTestUrl).hostname.toLowerCase();
  if (postgresTestHost !== "127.0.0.1" && postgresTestHost !== "localhost") {
    throw new Error(
      "CI_POSTGRES_ADMIN_URL must point to a local PostgreSQL server."
    );
  }
}

const directDatabaseUrl =
  "postgresql://operator:secret@dev.example.neon.tech/hub?sslmode=verify-full";
const COALESCED_EMAIL_STATUS_PATTERN =
  /coalesce\(\s*email_status = any\(\$1::email_message_status\[\]\),\s*false\s*\)/;

const environment = {
  DATABASE_URL_DIRECT: directDatabaseUrl,
  DEVELOPMENT_DATABASE_HOST: "dev.example.neon.tech",
};
const postgresOrderIds = {
  acceptedWithoutLedger: "00000000-0000-4000-8000-000000000002",
  currentIntent: "00000000-0000-4000-8000-000000000004",
  historicalUnattempted: "00000000-0000-4000-8000-000000000003",
  unledgeredInFlight: "00000000-0000-4000-8000-000000000005",
  unledgeredUnattempted: "00000000-0000-4000-8000-000000000001",
} as const;

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
  it("loads the operational command and rejects missing arguments before connecting", () => {
    const environment = {
      ...process.env,
      DATABASE_URL_DIRECT: "",
      DEVELOPMENT_DATABASE_HOST: "",
    };
    const command = "run ops:reconcile:legacy-purchase-confirmations";
    const result =
      process.platform === "win32"
        ? spawnSync("cmd.exe", ["/d", "/s", "/c", `bun ${command}`], {
            cwd: process.cwd(),
            encoding: "utf8",
            env: environment,
            timeout: 15_000,
          })
        : spawnSync(
            "bun",
            ["run", "ops:reconcile:legacy-purchase-confirmations"],
            {
              cwd: process.cwd(),
              encoding: "utf8",
              env: environment,
              timeout: 15_000,
            }
          );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Use exactly --environment=");
    expect(result.stderr).not.toContain("Client Component module");
    expect(result.stderr).not.toContain("ECONNREFUSED");
  });

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
      if (statement.includes("with candidates as")) {
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

  it("reconciles a valid legacy purchase even when migration 0098 did not backfill its ledger row", async () => {
    const candidate = { order_id: "order-without-ledger", user_id: "user-1" };
    const { client, query } = makeClient((statement) => {
      if (statement.includes("to_regclass")) {
        return { rows: [{ schema_ready: true }] };
      }
      if (statement.includes("from per_order")) {
        return {
          rows: [{ ambiguous: 0, eligible: 1, in_flight: 0, total: 1 }],
        };
      }
      if (
        statement.includes("from orders") &&
        statement.includes("left join purchase_confirmation_intents")
      ) {
        return { rows: [candidate] };
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
    ).resolves.toMatchObject({ enqueued: 1, processed: 1 });

    expect(replaceLegacy).toHaveBeenCalledWith({
      client,
      orderId: candidate.order_id,
      replaceHistorical: true,
      userId: candidate.user_id,
    });
    const candidateQuery = query.mock.calls
      .map(([statement]) => String(statement))
      .find((statement) => statement.includes("with candidates as"));
    expect(candidateQuery).toContain("intent.order_id is null");
    expect(candidateQuery).toContain("for update of orders");
  });

  it("records an ambiguous unledgered legacy purchase without sending another email", async () => {
    const candidate = {
      order_id: "accepted-without-ledger",
      user_id: "user-1",
    };
    const { client } = makeClient((statement) => {
      if (statement.includes("to_regclass")) {
        return { rows: [{ schema_ready: true }] };
      }
      if (statement.includes("from per_order")) {
        return {
          rows: [{ ambiguous: 1, eligible: 0, in_flight: 0, total: 1 }],
        };
      }
      if (
        statement.includes("from orders") &&
        statement.includes("left join purchase_confirmation_intents")
      ) {
        return { rows: [candidate] };
      }
      return { rows: [] };
    });
    const replaceLegacy = vi.fn(async () => "legacy_satisfied" as const);

    await expect(
      runPurchaseConfirmationLegacyCutover({
        client,
        mode: "execute",
        replaceLegacy,
      })
    ).resolves.toMatchObject({
      ambiguousLegacy: 1,
      enqueued: 0,
      processed: 1,
    });
    expect(replaceLegacy).toHaveBeenCalledOnce();
  });

  it("uses the lifecycle enum and treats missing email rows as non-ambiguous", async () => {
    const { client, query } = makeClient((statement) => {
      if (statement.includes("to_regclass")) {
        return { rows: [{ schema_ready: true }] };
      }
      if (statement.includes("from per_order")) {
        return {
          rows: [{ ambiguous: 0, eligible: 1, in_flight: 0, total: 1 }],
        };
      }
      return { rows: [] };
    });

    await runPurchaseConfirmationLegacyCutover({ client, mode: "dry-run" });

    const countQuery = query.mock.calls
      .map(([statement]) => String(statement))
      .find((statement) => statement.includes("from per_order"));
    expect(countQuery).toContain("$1::email_message_status[]");
    expect(countQuery).toMatch(COALESCED_EMAIL_STATUS_PATTERN);
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
    ).rejects.toThrow("Migrations 0098 and 0101 are not applied");
    expect(
      String(
        query.mock.calls.find(([statement]) =>
          String(statement).includes("to_regclass")
        )?.[0]
      )
    ).toContain("information_schema.columns");
    expect(query).toHaveBeenCalledWith("rollback");
  });
});

describe.skipIf(!postgresTestUrl)(
  "purchase confirmation cutover PostgreSQL SQL",
  () => {
    const pool = new Pool({
      application_name: "hub-purchase-confirmation-cutover-test",
      connectionString: postgresTestUrl,
      max: 1,
    });

    afterAll(async () => {
      await pool.end();
    });

    it("counts unledgered historical purchases and treats null lifecycle rows as eligible", async () => {
      const client = await pool.connect();
      const schema = `purchase_cutover_test_${randomBytes(8).toString("hex")}`;
      let transactionOpen = false;
      try {
        await client.query("begin");
        transactionOpen = true;
        await client.query(`create schema "${schema}"`);
        await client.query(`set local search_path to "${schema}", public`);
        await client.query(`
        create type order_status as enum (
          'pending', 'paid', 'refunded', 'disputed', 'cancelled'
        );
        create type buyer_identity_status as enum (
          'pending', 'resolved', 'review_required'
        );
        create type purchase_confirmation_intent_origin as enum (
          'historical', 'current'
        );
        create type outbox_status as enum (
          'pending', 'processing', 'retrying', 'delivered', 'dead_letter', 'superseded'
        );
        create type email_delivery_topic as enum (
          'auth.account-activation', 'email.access-released'
        );
        create type email_message_status as enum (
          'sending', 'acceptance_unknown', 'accepted', 'delayed',
          'delivered', 'failed', 'suppressed', 'bounced', 'complained'
        );
        create table orders (
          id uuid primary key,
          status order_status not null,
          buyer_identity_status buyer_identity_status not null,
          user_id text not null
        );
        create table purchase_confirmation_intents (
          order_id uuid primary key,
          origin purchase_confirmation_intent_origin not null
        );
        create table outbox_messages (
          id uuid primary key,
          aggregate_type text not null,
          aggregate_id text not null,
          topic email_delivery_topic not null,
          status outbox_status not null
        );
        create table email_messages (
          outbox_message_id uuid primary key,
          status email_message_status not null
        );
      `);

        const fixtures = [
          {
            emailStatus: null,
            ledgerOrigin: null,
            outboxStatus: "pending",
            orderId: postgresOrderIds.unledgeredUnattempted,
          },
          {
            emailStatus: "accepted",
            ledgerOrigin: null,
            outboxStatus: "pending",
            orderId: postgresOrderIds.acceptedWithoutLedger,
          },
          {
            emailStatus: null,
            ledgerOrigin: "historical",
            outboxStatus: "pending",
            orderId: postgresOrderIds.historicalUnattempted,
          },
          {
            emailStatus: null,
            ledgerOrigin: "current",
            outboxStatus: "pending",
            orderId: postgresOrderIds.currentIntent,
          },
          {
            emailStatus: null,
            ledgerOrigin: null,
            outboxStatus: "processing",
            orderId: postgresOrderIds.unledgeredInFlight,
          },
        ] as const;

        for (const [index, fixture] of fixtures.entries()) {
          const messageId = `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
          await client.query(
            `insert into orders (id, status, buyer_identity_status, user_id)
           values ($1, 'paid', 'resolved', 'user-1')`,
            [fixture.orderId]
          );
          if (fixture.ledgerOrigin) {
            await client.query(
              `insert into purchase_confirmation_intents (order_id, origin)
             values ($1, $2)`,
              [fixture.orderId, fixture.ledgerOrigin]
            );
          }
          await client.query(
            `insert into outbox_messages (id, aggregate_type, aggregate_id, topic, status)
           values ($1, 'order', $2, 'auth.account-activation', $3)`,
            [messageId, fixture.orderId, fixture.outboxStatus]
          );
          if (fixture.emailStatus) {
            await client.query(
              `insert into email_messages (outbox_message_id, status)
             values ($1, $2::email_message_status)`,
              [messageId, fixture.emailStatus]
            );
          }
        }

        await expect(
          getPurchaseConfirmationCutoverCounts(client)
        ).resolves.toEqual({
          ambiguous: 2,
          eligible: 2,
          in_flight: 1,
          total: 4,
        });

        await expect(
          getPurchaseConfirmationLegacyCutoverCandidates(client)
        ).resolves.toMatchObject([
          { order_id: postgresOrderIds.unledgeredUnattempted },
          { order_id: postgresOrderIds.acceptedWithoutLedger },
          { order_id: postgresOrderIds.historicalUnattempted },
        ]);
      } finally {
        try {
          if (transactionOpen) {
            await client.query("rollback");
          }
        } finally {
          client.release();
        }
      }
    });
  }
);
