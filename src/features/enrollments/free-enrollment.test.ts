import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  connect: vi.fn(),
  insertEnrollmentEvent: vi.fn(),
  lockEnrollmentAggregate: vi.fn(),
  rebuildEnrollmentProjection: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  getPool: () => ({ connect: dependencies.connect }),
}));
vi.mock("./enrollment-aggregate-lock", () => ({
  lockEnrollmentAggregate: dependencies.lockEnrollmentAggregate,
}));
vi.mock("./server", () => ({
  insertEnrollmentEvent: dependencies.insertEnrollmentEvent,
  rebuildEnrollmentProjection: dependencies.rebuildEnrollmentProjection,
}));

import { enrollInFreeCourse } from "./free-enrollment";
import { addMonths } from "./rules";

const COURSE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "student-1";
const NOW = new Date("2026-09-15T12:00:00.000Z");
const PAID_INFRASTRUCTURE_PATTERN =
  /@\/features\/payments|Asaas|orders|public-checkout/i;

interface CourseRow {
  access_duration_months: number;
  catalog_visibility: "hidden" | "listed";
  has_published_publication: boolean;
  id: string;
  max_release_delay_days: number;
  price_in_cents: number;
  sales_status: "closed" | "open";
  status: "active" | "archived" | "draft";
}

const ACTIVE_COURSE: CourseRow = {
  access_duration_months: 3,
  catalog_visibility: "listed" as const,
  has_published_publication: true,
  id: COURSE_ID,
  max_release_delay_days: 30,
  price_in_cents: 0,
  sales_status: "open" as const,
  status: "active" as const,
};

interface EnrollmentRow {
  status: "active" | "expired" | "revoked";
}

interface GrantRow {
  effective_expires_at: Date;
  id: string;
  revoked_reason: string | null;
  starts_at: Date;
  status: "active" | "cancelled" | "disputed" | "expired" | "refunded";
}

const createClient = ({
  activeGrant = null,
  course = ACTIVE_COURSE,
  enrollment = null,
  failOn,
  freeGrant = null,
  upsertId = "free-grant-1",
}: {
  activeGrant?: { id: string } | null;
  course?: CourseRow | null;
  enrollment?: EnrollmentRow | null;
  failOn?: string;
  freeGrant?: GrantRow | null;
  upsertId?: string;
} = {}) => {
  const query = vi.fn((sql: string, _params: unknown[] = []) => {
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (failOn && normalized.includes(failOn)) {
      return Promise.reject(new Error("database failure"));
    }
    if (["begin", "commit", "rollback"].includes(normalized)) {
      return Promise.resolve({ rows: [] });
    }
    if (normalized.includes("from courses c")) {
      return Promise.resolve({ rows: course ? [course] : [] });
    }
    if (
      normalized.includes("from enrollments") &&
      normalized.includes("where user_id = $1") &&
      normalized.includes("for update")
    ) {
      return Promise.resolve({ rows: enrollment ? [enrollment] : [] });
    }
    if (
      normalized.includes("from enrollment_grants") &&
      normalized.includes("source_type = 'free_enrollment'") &&
      normalized.includes("for update")
    ) {
      return Promise.resolve({ rows: freeGrant ? [freeGrant] : [] });
    }
    if (
      normalized.includes("from enrollment_grants") &&
      normalized.includes("status = 'active'") &&
      normalized.includes("starts_at <= $3")
    ) {
      return Promise.resolve({ rows: activeGrant ? [activeGrant] : [] });
    }
    if (normalized.includes("insert into enrollment_grants")) {
      return Promise.resolve({ rows: [{ id: upsertId }] });
    }
    return Promise.reject(new Error(`Unexpected query: ${sql}`));
  });

  return { query, release: vi.fn() };
};

const configureClient = (options?: Parameters<typeof createClient>[0]) => {
  const client = createClient(options);
  dependencies.connect.mockResolvedValue(client);
  return client;
};

const expectRollback = (client: ReturnType<typeof createClient>): void => {
  expect(client.query).toHaveBeenCalledWith("rollback");
  expect(client.query).not.toHaveBeenCalledWith("commit");
  expect(client.release).toHaveBeenCalledOnce();
};

describe("free enrollment service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.lockEnrollmentAggregate.mockResolvedValue(undefined);
    dependencies.insertEnrollmentEvent.mockResolvedValue(undefined);
    dependencies.rebuildEnrollmentProjection.mockResolvedValue(undefined);
  });

  it("rejects an invalid Course id before opening a database connection", async () => {
    await expect(
      enrollInFreeCourse({ courseId: "course-1", now: NOW, userId: USER_ID })
    ).rejects.toThrow("Curso inválido.");

    expect(dependencies.connect).not.toHaveBeenCalled();
    expect(dependencies.lockEnrollmentAggregate).not.toHaveBeenCalled();
  });

  it("creates one free grant, emits the domain event, rebuilds projection, and commits", async () => {
    const client = configureClient();

    await expect(
      enrollInFreeCourse({ courseId: COURSE_ID, now: NOW, userId: USER_ID })
    ).resolves.toEqual({ status: "created" });

    expect(dependencies.lockEnrollmentAggregate).toHaveBeenCalledWith(
      client,
      USER_ID,
      COURSE_ID
    );
    const courseQueryIndex = client.query.mock.calls.findIndex(([sql]) =>
      String(sql).includes("from courses c")
    );
    const lockCallOrder =
      dependencies.lockEnrollmentAggregate.mock.invocationCallOrder[0];
    const courseQueryCallOrder =
      client.query.mock.invocationCallOrder[courseQueryIndex];
    if (lockCallOrder === undefined || courseQueryCallOrder === undefined) {
      throw new Error(
        "Não foi possível observar a ordem do lock e da leitura."
      );
    }
    expect(lockCallOrder).toBeLessThan(courseQueryCallOrder);

    const courseSql = String(client.query.mock.calls[courseQueryIndex]?.[0]);
    expect(courseSql).toContain("c.status");
    expect(courseSql).toContain("c.sales_status");
    expect(courseSql).toContain("c.price_in_cents");
    expect(courseSql).toContain("c.access_duration_months");
    expect(courseSql).toContain("cp.status = 'published'");
    expect(courseSql).toContain("for update");
    const effectiveGrantSql = String(
      client.query.mock.calls.find(([sql]) =>
        String(sql).includes("starts_at <= $3")
      )?.[0]
    );
    expect(effectiveGrantSql).not.toContain("source_type");

    const expectedExpiresAt = addMonths(NOW, 3);
    expect(dependencies.insertEnrollmentEvent).toHaveBeenCalledWith(client, {
      courseId: COURSE_ID,
      eventType: "free_enrollment_granted",
      grantId: "free-grant-1",
      metadata: {
        accessDurationMonths: 3,
        expiresAt: expectedExpiresAt.toISOString(),
        previousExpiresAt: null,
        previousStartsAt: null,
        reactivated: false,
        startsAt: NOW.toISOString(),
      },
      userId: USER_ID,
    });
    expect(dependencies.rebuildEnrollmentProjection).toHaveBeenCalledWith({
      client,
      courseId: COURSE_ID,
      now: NOW,
      userId: USER_ID,
    });
    expect(client.query).toHaveBeenCalledWith("commit");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("returns already_active without creating another grant or event", async () => {
    const client = configureClient({ activeGrant: { id: "paid-grant-1" } });

    await expect(
      enrollInFreeCourse({ courseId: COURSE_ID, now: NOW, userId: USER_ID })
    ).resolves.toEqual({ status: "already_active" });

    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes("insert into enrollment_grants")
      )
    ).toBe(false);
    expect(dependencies.insertEnrollmentEvent).not.toHaveBeenCalled();
    expect(dependencies.rebuildEnrollmentProjection).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith("commit");
  });

  it("reactivates the same expired free grant with a new window", async () => {
    const previousStartsAt = new Date("2026-05-15T12:00:00.000Z");
    const previousExpiresAt = new Date("2026-08-15T12:00:00.000Z");
    const client = configureClient({
      enrollment: { status: "expired" },
      freeGrant: {
        effective_expires_at: previousExpiresAt,
        id: "free-grant-1",
        revoked_reason: null,
        starts_at: previousStartsAt,
        status: "expired",
      },
      upsertId: "free-grant-1",
    });

    await expect(
      enrollInFreeCourse({ courseId: COURSE_ID, now: NOW, userId: USER_ID })
    ).resolves.toEqual({ status: "reactivated" });

    const expectedExpiresAt = addMonths(NOW, 3);
    expect(dependencies.insertEnrollmentEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: "free_enrollment_granted",
        grantId: "free-grant-1",
        metadata: {
          accessDurationMonths: 3,
          expiresAt: expectedExpiresAt.toISOString(),
          previousExpiresAt: previousExpiresAt.toISOString(),
          previousStartsAt: previousStartsAt.toISOString(),
          reactivated: true,
          startsAt: NOW.toISOString(),
        },
      })
    );
    const upsertSql = String(
      client.query.mock.calls.find(([sql]) =>
        String(sql).includes("insert into enrollment_grants")
      )?.[0]
    );
    expect(upsertSql).toContain(
      "on conflict (user_id, course_id) where source_type = 'free_enrollment'"
    );
    expect(upsertSql).toContain("order_id");
    expect(upsertSql).toContain("manual_reference");
    expect(client.query).toHaveBeenCalledWith("commit");
  });

  it("rejects a revoked enrollment before creating free access", async () => {
    const client = configureClient({ enrollment: { status: "revoked" } });

    await expect(
      enrollInFreeCourse({ courseId: COURSE_ID, now: NOW, userId: USER_ID })
    ).rejects.toThrow("Matrícula revogada não pode receber novo acesso.");

    expectRollback(client);
    expect(dependencies.insertEnrollmentEvent).not.toHaveBeenCalled();
    expect(dependencies.rebuildEnrollmentProjection).not.toHaveBeenCalled();
  });

  it.each([
    "cancelled",
    "disputed",
    "refunded",
  ] as const)("rejects a terminal free grant: %s", async (status) => {
    const client = configureClient({
      freeGrant: {
        effective_expires_at: new Date("2026-10-15T12:00:00.000Z"),
        id: "free-grant-1",
        revoked_reason: status === "cancelled" ? "manual_access_block" : null,
        starts_at: NOW,
        status,
      },
    });

    await expect(
      enrollInFreeCourse({ courseId: COURSE_ID, now: NOW, userId: USER_ID })
    ).rejects.toThrow("Concessão gratuita encerrada não pode ser reativada.");

    expectRollback(client);
  });

  const invalidCourseCases: [string, Partial<CourseRow>, string][] = [
    ["closed sales", { sales_status: "closed" }, "Estado de vendas fechado."],
    ["non-zero price", { price_in_cents: 1000 }, "Preço diferente de zero."],
    [
      "missing publication",
      { has_published_publication: false },
      "Publicação de Curso ausente.",
    ],
    [
      "draft course",
      { status: "draft" },
      "Curso inexistente, arquivado, draft ou inativo.",
    ],
    [
      "invalid duration",
      { access_duration_months: 0 },
      "Duração de acesso inválida.",
    ],
    [
      "incompatible schedule",
      { max_release_delay_days: 84 },
      "Cronograma incompatível.",
    ],
  ];

  it.each(
    invalidCourseCases
  )("rejects %s before grant mutation", async (_case, changes, message) => {
    const client = configureClient({
      course: { ...ACTIVE_COURSE, ...changes },
    });

    await expect(
      enrollInFreeCourse({ courseId: COURSE_ID, now: NOW, userId: USER_ID })
    ).rejects.toThrow(message);

    expectRollback(client);
    expect(dependencies.insertEnrollmentEvent).not.toHaveBeenCalled();
    expect(dependencies.rebuildEnrollmentProjection).not.toHaveBeenCalled();
  });

  it("rolls back and releases the client when a grant mutation fails", async () => {
    const client = configureClient({ failOn: "insert into enrollment_grants" });

    await expect(
      enrollInFreeCourse({ courseId: COURSE_ID, now: NOW, userId: USER_ID })
    ).rejects.toThrow("database failure");

    expectRollback(client);
    expect(dependencies.insertEnrollmentEvent).not.toHaveBeenCalled();
    expect(dependencies.rebuildEnrollmentProjection).not.toHaveBeenCalled();
  });

  it("keeps the service outside paid infrastructure and reuses domain helpers", async () => {
    const source = await readFile(
      new URL("./free-enrollment.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain('import "server-only";');
    expect(source).toContain("lockEnrollmentAggregate");
    expect(source).toContain("rebuildEnrollmentProjection");
    expect(source).toContain("insertEnrollmentEvent");
    expect(source).toContain("addMonths");
    expect(source).not.toMatch(PAID_INFRASTRUCTURE_PATTERN);
  });
});
