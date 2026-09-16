import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";
import { withVerifiedSslMode } from "@/db/connection-url";

const databaseUrl = process.env.CERTIFICATE_CONCURRENCY_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "CERTIFICATE_CONCURRENCY_DATABASE_URL is required for integration tests."
  );
}

const pool = new Pool({
  application_name: "protea-r-authoring-module-integration",
  connectionString: withVerifiedSslMode(databaseUrl),
  max: 6,
});
const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
}));
dependencies.getPool.mockReturnValue(pool);

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));

import { saveModule } from "./authoring";

afterAll(async () => {
  await pool.end();
});

const createModuleForm = ({
  courseId,
  title,
}: {
  courseId: string;
  title: string;
}): FormData => {
  const formData = new FormData();
  formData.set("courseId", courseId);
  formData.set("title", title);
  formData.set("sortOrder", "1");
  formData.set("releaseMode", "immediate");
  return formData;
};

describe("admin authoring PostgreSQL concurrency", () => {
  it("creates two modules instead of overwriting when requests race", async () => {
    const actorUserId = `authoring-${randomUUID()}`;
    const courseId = randomUUID();
    const publicationId = randomUUID();
    const initialModuleId = randomUUID();

    await pool.query(
      `insert into users (id, name, email, email_verified)
       values ($1, 'Authoring integration', $2, true)`,
      [actorUserId, `${actorUserId}@example.test`]
    );
    await pool.query(
      `insert into courses (id, slug, title)
       values ($1, $2, 'Authoring integration course')`,
      [courseId, `authoring-${randomUUID()}`]
    );
    await pool.query(
      `insert into course_publications (id, course_id, publication_number, title_snapshot)
       values ($1, $2, 1, 'Authoring integration course')`,
      [publicationId, courseId]
    );
    await pool.query(
      `insert into modules (
         id, course_id, course_publication_id, title, sort_order, status
       ) values ($1, $2, $3, 'Initial module', 1, 'draft')`,
      [initialModuleId, courseId, publicationId]
    );

    try {
      const results = await Promise.all([
        saveModule({
          actorUserId,
          formData: createModuleForm({
            courseId,
            title: "Cardiologia",
          }),
        }),
        saveModule({
          actorUserId,
          formData: createModuleForm({
            courseId,
            title: "Neurologia",
          }),
        }),
      ]);

      expect(results).toHaveLength(2);
      const modules = await pool.query<{
        id: string;
        sort_order: number;
        title: string;
      }>(
        `select id, title, sort_order
         from modules
         where course_publication_id = $1
         order by sort_order, id`,
        [publicationId]
      );

      expect(modules.rows).toHaveLength(3);
      expect(modules.rows.slice(1).map(({ sort_order }) => sort_order)).toEqual(
        [2, 3]
      );
      expect(new Set(modules.rows.slice(1).map(({ id }) => id)).size).toBe(2);
      expect(
        modules.rows
          .slice(1)
          .map(({ title }) => title)
          .sort()
      ).toEqual(["Cardiologia", "Neurologia"]);
    } finally {
      await pool.query("delete from audit_logs where actor_user_id = $1", [
        actorUserId,
      ]);
      await pool.query("delete from courses where id = $1", [courseId]);
      await pool.query("delete from users where id = $1", [actorUserId]);
    }
  });
});
