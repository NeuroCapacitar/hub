import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { withVerifiedSslMode } from "@/db/connection-url";
import {
  buildFinancialAnalyticsQuery,
  getConfirmedSalePredicate,
} from "./financial-metrics-query";

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "INTEGRATION_DATABASE_URL is required for financial PostgreSQL integration tests."
  );
}

const parsedDatabaseUrl = new URL(databaseUrl);
if (
  !["127.0.0.1", "localhost", "::1"].includes(parsedDatabaseUrl.hostname) ||
  parsedDatabaseUrl.pathname !== "/hub_integration"
) {
  throw new Error(
    "Financial integration tests only run against the local hub_integration database."
  );
}

const pool = new Pool({
  connectionString: withVerifiedSslMode(databaseUrl),
  max: 1,
});

describe("financial analytics PostgreSQL projection", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("preserves confirmed gross sales and keeps payment and refund periods distinct", async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(`
        create temporary table orders (
          id uuid primary key,
          course_id uuid not null default '20000000-0000-4000-8000-000000000001',
          status text not null,
          paid_at timestamptz,
          provider_payment_date date,
          paid_amount_in_cents integer,
          amount_in_cents integer not null,
          fee_amount_in_cents integer,
          net_amount_in_cents integer,
          provider_payment_id text,
          provider_installment_id text,
          checkout_status text not null default 'pending',
          provider_checkout_id text,
          checkout_url text,
          provider_payment_status text,
          provider_checkout_status text,
          created_at timestamptz not null,
          refunded_at timestamptz
        ) on commit drop
      `);
      await client.query(`
        create temporary table courses (
          id uuid primary key,
          title text not null
        ) on commit drop
      `);
      await client.query(
        `insert into courses (id, title)
         values ('20000000-0000-4000-8000-000000000001', 'Integration course')`
      );
      await client.query(`
        create temporary table refund_requests (
          order_id uuid not null,
          status text not null,
          confirmed_at timestamptz,
          provider_refunded_amount_in_cents integer
        ) on commit drop
      `);
      await client.query(`
        create temporary table payment_reviews (
          order_id uuid not null,
          status text not null,
          type text not null,
          created_at timestamptz not null
        ) on commit drop
      `);
      await client.query(
        `insert into orders (
          id, status, paid_at, provider_payment_date, paid_amount_in_cents,
          amount_in_cents, fee_amount_in_cents, net_amount_in_cents,
          provider_payment_id, created_at, refunded_at
        ) values
          ('10000000-0000-4000-8000-000000000001', 'paid', '2026-09-12T12:00:00Z', '2026-09-12', 10000, 10000, 1000, 9000, 'pay-current-paid', '2026-09-12T12:00:00Z', null),
          ('10000000-0000-4000-8000-000000000002', 'refunded', '2026-09-13T12:00:00Z', '2026-09-13', 20000, 20000, 2000, 18000, 'pay-current-refunded', '2026-09-13T12:00:00Z', '2026-09-20T12:00:00Z'),
          ('10000000-0000-4000-8000-000000000003', 'disputed', '2026-09-14T12:00:00Z', '2026-09-14', 30000, 30000, 3000, 27000, 'pay-current-disputed', '2026-09-14T12:00:00Z', null),
          ('10000000-0000-4000-8000-000000000004', 'paid', '2026-09-15T12:00:00Z', null, 4000, 4000, 400, 3600, 'pay-hub-date-fallback', '2026-09-15T12:00:00Z', null),
          ('10000000-0000-4000-8000-000000000005', 'paid', '2026-09-15T12:00:00Z', '2026-08-31', 6000, 6000, 600, 5400, 'pay-provider-date-wins', '2026-09-15T12:00:00Z', null),
          ('10000000-0000-4000-8000-000000000006', 'refunded', '2026-08-20T12:00:00Z', '2026-08-20', 50000, 50000, 5000, 45000, 'pay-old-refunded', '2026-08-20T12:00:00Z', '2026-09-22T12:00:00Z'),
          ('10000000-0000-4000-8000-000000000007', 'paid', '2026-08-25T12:00:00Z', '2026-08-25', 5000, 5000, 500, 4500, 'pay-old-partial-review', '2026-08-25T12:00:00Z', null)`
      );
      await client.query(
        `insert into refund_requests (
          order_id, status, confirmed_at, provider_refunded_amount_in_cents
        ) values
          ('10000000-0000-4000-8000-000000000002', 'confirmed', '2026-09-20T12:00:00Z', 5000),
          ('10000000-0000-4000-8000-000000000006', 'confirmed', '2026-09-22T12:00:00Z', 20000)`
      );
      await client.query(
        `insert into payment_reviews (order_id, status, type, created_at)
         values
           ('10000000-0000-4000-8000-000000000003', 'pending', 'partial_refund', '2026-09-20T12:00:00Z'),
           ('10000000-0000-4000-8000-000000000007', 'pending', 'partial_refund', '2026-08-27T12:00:00Z')`
      );

      const lifetime = await client.query(
        `select
           count(*) filter (where ${getConfirmedSalePredicate("")})::int as confirmed_sale_orders,
           coalesce(sum(paid_amount_in_cents) filter (where ${getConfirmedSalePredicate("")}), 0)::bigint as gross_confirmed_sales_in_cents
         from orders`
      );
      const courseLifetime = await client.query(
        `select
           count(*) filter (where ${getConfirmedSalePredicate("o")})::int as confirmed_sale_orders,
           coalesce(sum(o.paid_amount_in_cents) filter (where ${getConfirmedSalePredicate("o")}), 0)::bigint as gross_confirmed_sales_in_cents
         from courses c
         left join orders o on o.course_id = c.id
         group by c.id`
      );

      expect(lifetime.rows[0]).toMatchObject({
        confirmed_sale_orders: 7,
        gross_confirmed_sales_in_cents: "125000",
      });
      expect(courseLifetime.rows[0]).toEqual(lifetime.rows[0]);

      const result = await client.query(
        buildFinancialAnalyticsQuery({
          fromDate: new Date("2026-09-01T00:00:00.000Z"),
          periodEnd: new Date("2026-09-30T23:59:59.000Z"),
        })
      );

      expect(result.rows[0]).toMatchObject({
        active_checkout_count: 0,
        active_checkout_potential_in_cents: "0",
        confirmed_sale_orders: 4,
        fees_in_cents: "6400",
        gross_confirmed_sales_in_cents: "64000",
        missing_fee_evidence_orders: 0,
        pending_partial_refund_review_count: 1,
        provider_payment_date_fallback_orders: 1,
        refunded_orders: 2,
        refunded_revenue_in_cents: "25000",
      });
    } finally {
      await client.query("rollback");
      client.release();
    }
  });
});
