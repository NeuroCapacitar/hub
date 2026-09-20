import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { withVerifiedSslMode } from "@/db/connection-url";

const databaseUrl = process.env.INTEGRATION_DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error(
    "INTEGRATION_DATABASE_URL is required for integration tests."
  );
}

const pool = new Pool({
  application_name: "hub-staff-role-transition-integration",
  connectionString: withVerifiedSslMode(databaseUrl),
  max: 2,
});

afterAll(async () => {
  await pool.end();
});

describe("staff role transition schema", () => {
  it("allows role changes without the removed support_mode column", async () => {
    const client = await pool.connect();
    const userId = `staff-transition-${randomUUID()}`;

    try {
      await client.query("begin");

      const legacyColumn = await client.query(
        "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'support_mode'"
      );
      expect(legacyColumn.rows).toHaveLength(0);

      await client.query(
        "insert into users (id, name, email, email_verified) values ($1, 'Staff transition', $2, true)",
        [userId, `${userId}@example.test`]
      );
      await client.query(
        "update profiles set role = 'support', support_permission_grants = '{}'::text[], support_permission_views = '{}'::text[] where user_id = $1",
        [userId]
      );

      await client.query(
        "update profiles set role = 'student', support_permission_grants = '{}'::text[], support_permission_views = '{}'::text[] where user_id = $1",
        [userId]
      );
      await client.query(
        "update profiles set role = 'support', support_permission_grants = '{}'::text[], support_permission_views = '{}'::text[] where user_id = $1",
        [userId]
      );

      const profile = await client.query(
        "select role from profiles where user_id = $1",
        [userId]
      );
      expect(profile.rows[0]?.role).toBe("support");
    } finally {
      await client.query("rollback");
      client.release();
    }
  });
});
