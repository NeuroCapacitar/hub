import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withVerifiedSslMode } from "@/db/connection-url";
import { isProductionNeonHost } from "@/db/migration-target";
import { lockCourseContentRelease } from "@/features/courses/content-release-lock";

const databaseUrl =
  process.env.CERTIFICATE_CONCURRENCY_DATABASE_URL?.trim() ||
  process.env.INTEGRATION_DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error(
    "CERTIFICATE_CONCURRENCY_DATABASE_URL is required for integration tests."
  );
}

let parsedDatabaseUrl: URL;
try {
  parsedDatabaseUrl = new URL(databaseUrl);
} catch {
  throw new Error("Integration database URL must be a valid PostgreSQL URL.");
}
if (
  !["postgres:", "postgresql:"].includes(parsedDatabaseUrl.protocol) ||
  isProductionNeonHost(parsedDatabaseUrl.hostname) ||
  parsedDatabaseUrl.hostname.toLowerCase().includes("-pooler.")
) {
  throw new Error(
    "Free enrollment integration tests require a non-production direct PostgreSQL database."
  );
}

const previousEnvironment = {
  ASAAS_WEBHOOK_ENABLED: process.env.ASAAS_WEBHOOK_ENABLED,
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_DIRECT: process.env.DATABASE_URL_DIRECT,
  PAYMENTS_CHECKOUT_MODE: process.env.PAYMENTS_CHECKOUT_MODE,
};
process.env.ASAAS_WEBHOOK_ENABLED = "false";
process.env.DATABASE_URL = databaseUrl;
process.env.DATABASE_URL_DIRECT = databaseUrl;
process.env.PAYMENTS_CHECKOUT_MODE = "disabled";

vi.mock("server-only", () => ({}));

import { resolveCourseAccess } from "./access";
import { enrollInFreeCourse } from "./free-enrollment";
import { processEnrollmentMaintenance } from "./maintenance";
import { blockEnrollmentAccess, restoreEnrollmentAccess } from "./server";

const ACCESS_DURATION_MONTHS = 3;
const LOCK_OBSERVATION_TIMEOUT_MS = 30_000;
const NOW = new Date("2026-09-15T12:00:00.000Z");
const pool = new Pool({
  application_name: "protea-r-free-enrollment-integration",
  connectionString: withVerifiedSslMode(databaseUrl),
  connectionTimeoutMillis: 10_000,
  max: 8,
});
const fixtureCourseIds = new Set<string>();
const fixtureUserIds = new Set<string>();

interface FreeEnrollmentFixture {
  courseId: string;
  courseSlug: string;
  userId: string;
}

interface GrantStateRow {
  effective_expires_at: Date;
  manual_reference: string | null;
  order_id: string | null;
  revoked_reason: string | null;
  source_type: string;
  status: string;
}

const rollbackQuietly = async (client: PoolClient): Promise<void> => {
  await client.query("rollback").catch(() => undefined);
};

const cleanupFixtures = async (): Promise<void> => {
  if (fixtureCourseIds.size > 0) {
    await pool.query("delete from courses where id = any($1::uuid[])", [
      [...fixtureCourseIds],
    ]);
    fixtureCourseIds.clear();
  }
  if (fixtureUserIds.size > 0) {
    await pool.query(
      "delete from audit_logs where actor_user_id = any($1::text[])",
      [[...fixtureUserIds]]
    );
    await pool.query("delete from users where id = any($1::text[])", [
      [...fixtureUserIds],
    ]);
    fixtureUserIds.clear();
  }
};

const createFixture = async (): Promise<FreeEnrollmentFixture> => {
  const courseId = randomUUID();
  const coursePublicationId = randomUUID();
  const moduleId = randomUUID();
  const lessonId = randomUUID();
  const suffix = randomUUID();
  const courseSlug = `free-enrollment-${suffix}`;
  const userId = `free-enrollment-${suffix}`;
  fixtureCourseIds.add(courseId);
  fixtureUserIds.add(userId);

  await pool.query(
    `
      insert into users (id, name, email, email_verified)
      values ($1, 'Aluno de integração gratuita', $2, true)
    `,
    [userId, `${userId}@example.test`]
  );
  await pool.query(
    `
      insert into profiles (user_id, role)
      values ($1, 'student')
      on conflict (user_id) do nothing
    `,
    [userId]
  );
  await pool.query(
    `
      insert into courses (
        id,
        slug,
        title,
        description,
        workload_hours,
        price_in_cents,
        payment_allow_pix,
        payment_allow_credit_card,
        payment_max_installment_count,
        access_duration_months,
        status,
        catalog_visibility,
        sales_status
      )
      values (
        $1,
        $2,
        'Curso gratuito de integração',
        'Curso usado somente em testes descartáveis.',
        1,
        0,
        true,
        true,
        3,
        $3,
        'active',
        'listed',
        'open'
      )
    `,
    [courseId, courseSlug, ACCESS_DURATION_MONTHS]
  );
  await pool.query(
    `
      insert into course_publications (
        id,
        course_id,
        publication_number,
        status,
        title_snapshot,
        workload_hours_snapshot,
        published_at
      )
      values ($1, $2, 1, 'published', 'Curso gratuito de integração', 1, $3)
    `,
    [coursePublicationId, courseId, NOW]
  );
  await pool.query(
    `
      insert into modules (
        id,
        course_id,
        course_publication_id,
        title,
        sort_order,
        release_delay_days,
        status
      )
      values ($1, $2, $3, 'Módulo inicial', 1, 0, 'active')
    `,
    [moduleId, courseId, coursePublicationId]
  );
  await pool.query(
    `
      insert into lessons (
        id,
        module_id,
        course_publication_id,
        title,
        sort_order,
        status,
        is_published,
        is_required
      )
      values ($1, $2, $3, 'Aula inicial', 1, 'active', true, true)
    `,
    [lessonId, moduleId, coursePublicationId]
  );

  return { courseId, courseSlug, userId };
};

const getEnrollmentId = async (
  fixture: FreeEnrollmentFixture
): Promise<string> => {
  const { rows } = await pool.query<{ id: string }>(
    `
      select id
      from enrollments
      where user_id = $1 and course_id = $2
    `,
    [fixture.userId, fixture.courseId]
  );
  const enrollmentId = rows[0]?.id;
  if (!enrollmentId) {
    throw new Error("Integration enrollment was not created.");
  }
  return enrollmentId;
};

const insertManualGrant = async (
  fixture: FreeEnrollmentFixture,
  now: Date
): Promise<string> => {
  const grantId = randomUUID();
  await pool.query(
    `
      insert into enrollment_grants (
        id,
        user_id,
        course_id,
        source_type,
        manual_reference,
        status,
        starts_at,
        base_expires_at,
        effective_expires_at
      )
      values ($1, $2, $3, 'manual', $4, 'active', $5, $6, $6)
    `,
    [
      grantId,
      fixture.userId,
      fixture.courseId,
      `manual-${grantId}`,
      now,
      new Date("2027-01-15T12:00:00.000Z"),
    ]
  );
  return grantId;
};

const insertPaidGrant = async (
  fixture: FreeEnrollmentFixture,
  now: Date
): Promise<{ grantId: string; orderId: string }> => {
  const grantId = randomUUID();
  const orderId = randomUUID();
  const paymentId = `integration-payment-${randomUUID()}`;
  const externalId = `integration-order-${randomUUID()}`;
  const expiresAt = new Date("2027-01-15T12:00:00.000Z");

  await pool.query(
    `
      insert into orders (
        id,
        course_id,
        user_id,
        buyer_identity_status,
        provider,
        provider_payment_id,
        external_id,
        status,
        amount_in_cents,
        access_duration_months,
        paid_amount_in_cents,
        paid_at,
        checkout_course_slug,
        checkout_item_name,
        checkout_item_description
      )
      values (
        $1,
        $2,
        $3,
        'resolved',
        'integration',
        $4,
        $5,
        'paid',
        1000,
        $6,
        1000,
        $7,
        $8,
        'Curso gratuito de integração',
        'Pedido pago usado somente no teste'
      )
    `,
    [
      orderId,
      fixture.courseId,
      fixture.userId,
      paymentId,
      externalId,
      ACCESS_DURATION_MONTHS,
      now,
      fixture.courseSlug,
    ]
  );
  await pool.query(
    `
      insert into enrollment_grants (
        id,
        user_id,
        course_id,
        source_type,
        order_id,
        status,
        starts_at,
        base_expires_at,
        effective_expires_at
      )
      values ($1, $2, $3, 'paid_order', $4, 'active', $5, $6, $6)
    `,
    [grantId, fixture.userId, fixture.courseId, orderId, now, expiresAt]
  );

  return { grantId, orderId };
};

const getGrantStates = async (
  fixture: FreeEnrollmentFixture
): Promise<GrantStateRow[]> => {
  const { rows } = await pool.query<GrantStateRow>(
    `
      select
        source_type,
        order_id,
        manual_reference,
        status,
        effective_expires_at,
        revoked_reason
      from enrollment_grants
      where user_id = $1 and course_id = $2
      order by source_type, id
    `,
    [fixture.userId, fixture.courseId]
  );
  return rows;
};

const getEventCount = async (
  fixture: FreeEnrollmentFixture,
  eventType: string
): Promise<number> => {
  const { rows } = await pool.query<{ count: number }>(
    `
      select count(*)::int as count
      from enrollment_events
      where user_id = $1
        and course_id = $2
        and event_type = $3::enrollment_event_type
    `,
    [fixture.userId, fixture.courseId, eventType]
  );
  return rows[0]?.count ?? 0;
};

const isWaitingForAdvisoryLock = async (): Promise<boolean> => {
  const { rows } = await pool.query<{ waiting: boolean }>(
    `
      select exists (
        select 1
        from pg_locks
        where locktype = 'advisory' and granted = false
      ) as waiting
    `
  );
  return rows[0]?.waiting ?? false;
};

describe("free enrollment PostgreSQL integration", () => {
  beforeEach(async () => {
    await cleanupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures();
    await pool.end();

    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("creates a free grant, active enrollment, and event without an Order", async () => {
    const fixture = await createFixture();

    await expect(
      enrollInFreeCourse({
        courseId: fixture.courseId,
        now: NOW,
        userId: fixture.userId,
      })
    ).resolves.toEqual({ status: "created" });

    const grants = await getGrantStates(fixture);
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({
      manual_reference: null,
      order_id: null,
      source_type: "free_enrollment",
      status: "active",
    });
    expect(await getEventCount(fixture, "free_enrollment_granted")).toBe(1);
    expect(await resolveCourseAccess(fixture)).toBe(true);

    const { rows: enrollmentRows } = await pool.query<{ status: string }>(
      "select status from enrollments where user_id = $1 and course_id = $2",
      [fixture.userId, fixture.courseId]
    );
    expect(enrollmentRows).toEqual([{ status: "active" }]);

    const { rows: orderRows } = await pool.query<{ count: number }>(
      "select count(*)::int as count from orders where user_id = $1 and course_id = $2",
      [fixture.userId, fixture.courseId]
    );
    expect(orderRows).toEqual([{ count: 0 }]);
  });

  it("serializes concurrent calls into one grant, one enrollment, and one event", async () => {
    const fixture = await createFixture();

    const results = await Promise.all([
      enrollInFreeCourse({
        courseId: fixture.courseId,
        now: NOW,
        userId: fixture.userId,
      }),
      enrollInFreeCourse({
        courseId: fixture.courseId,
        now: NOW,
        userId: fixture.userId,
      }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "already_active",
      "created",
    ]);
    expect(
      (await getGrantStates(fixture)).filter(
        (grant) => grant.source_type === "free_enrollment"
      )
    ).toHaveLength(1);
    expect(await getEventCount(fixture, "free_enrollment_granted")).toBe(1);
    const { rows: enrollmentRows } = await pool.query<{ count: number }>(
      "select count(*)::int as count from enrollments where user_id = $1 and course_id = $2",
      [fixture.userId, fixture.courseId]
    );
    expect(enrollmentRows).toEqual([{ count: 1 }]);
  });

  it("treats a retry after a lost response as already active", async () => {
    const fixture = await createFixture();
    const input = {
      courseId: fixture.courseId,
      now: NOW,
      userId: fixture.userId,
    };

    await expect(enrollInFreeCourse(input)).resolves.toEqual({
      status: "created",
    });
    await expect(enrollInFreeCourse(input)).resolves.toEqual({
      status: "already_active",
    });
    expect(await getEventCount(fixture, "free_enrollment_granted")).toBe(1);
    expect(
      (await getGrantStates(fixture)).filter(
        (grant) => grant.source_type === "free_enrollment"
      )
    ).toHaveLength(1);
  });

  it("reactivates an expired free grant with the same id and previous-window metadata", async () => {
    const fixture = await createFixture();
    const firstNow = new Date("2026-01-15T12:00:00.000Z");
    const firstExpiresAt = new Date("2026-04-15T12:00:00.000Z");
    const secondNow = new Date("2026-05-15T12:00:00.000Z");

    await enrollInFreeCourse({
      courseId: fixture.courseId,
      now: firstNow,
      userId: fixture.userId,
    });
    const before = await pool.query<{ id: string }>(
      `
        select id
        from enrollment_grants
        where user_id = $1 and course_id = $2 and source_type = 'free_enrollment'
      `,
      [fixture.userId, fixture.courseId]
    );
    const grantId = before.rows[0]?.id;
    if (!grantId) {
      throw new Error("Free integration grant was not created.");
    }
    await pool.query(
      `
        update enrollment_grants
        set status = 'expired', effective_expires_at = $3, updated_at = now()
        where id = $1 and user_id = $2
      `,
      [grantId, fixture.userId, firstExpiresAt]
    );
    await pool.query(
      `
        update enrollments
        set status = 'expired', updated_at = now()
        where user_id = $1 and course_id = $2
      `,
      [fixture.userId, fixture.courseId]
    );

    await expect(
      enrollInFreeCourse({
        courseId: fixture.courseId,
        now: secondNow,
        userId: fixture.userId,
      })
    ).resolves.toEqual({ status: "reactivated" });

    const after = await pool.query<{ id: string }>(
      `
        select id
        from enrollment_grants
        where user_id = $1 and course_id = $2 and source_type = 'free_enrollment'
      `,
      [fixture.userId, fixture.courseId]
    );
    expect(after.rows).toEqual([{ id: grantId }]);

    const events = await pool.query<{ metadata: Record<string, unknown> }>(
      `
        select metadata
        from enrollment_events
        where user_id = $1
          and course_id = $2
          and event_type = 'free_enrollment_granted'
        order by created_at, id
      `,
      [fixture.userId, fixture.courseId]
    );
    expect(events.rows).toHaveLength(2);
    expect(events.rows[0]?.metadata).toMatchObject({
      previousExpiresAt: null,
      previousStartsAt: null,
      reactivated: false,
    });
    expect(events.rows[1]?.metadata).toMatchObject({
      previousExpiresAt: firstExpiresAt.toISOString(),
      previousStartsAt: firstNow.toISOString(),
      reactivated: true,
      startsAt: secondNow.toISOString(),
    });
  });

  it("does not reactivate a revoked enrollment", async () => {
    const fixture = await createFixture();
    await enrollInFreeCourse({
      courseId: fixture.courseId,
      now: NOW,
      userId: fixture.userId,
    });
    await pool.query(
      `
        update enrollments
        set status = 'revoked', revoked_at = $3, revoked_reason = 'course_revoked'
        where user_id = $1 and course_id = $2
      `,
      [fixture.userId, fixture.courseId, NOW]
    );

    await expect(
      enrollInFreeCourse({
        courseId: fixture.courseId,
        now: new Date("2026-10-15T12:00:00.000Z"),
        userId: fixture.userId,
      })
    ).rejects.toThrow("Matrícula revogada não pode receber novo acesso.");
    expect(await getEventCount(fixture, "free_enrollment_granted")).toBe(1);
  });

  it("does not reactivate a free grant cancelled by manual blocking", async () => {
    const fixture = await createFixture();
    await enrollInFreeCourse({
      courseId: fixture.courseId,
      now: NOW,
      userId: fixture.userId,
    });
    await pool.query(
      `
        update enrollment_grants
        set status = 'cancelled',
            revoked_at = $3,
            revoked_reason = 'manual_access_block'
        where user_id = $1
          and course_id = $2
          and source_type = 'free_enrollment'
      `,
      [fixture.userId, fixture.courseId, NOW]
    );

    await expect(
      enrollInFreeCourse({
        courseId: fixture.courseId,
        now: new Date("2026-10-15T12:00:00.000Z"),
        userId: fixture.userId,
      })
    ).rejects.toThrow("Concessão gratuita encerrada não pode ser reativada.");
  });

  it("does not create a free grant when manual or paid access is already effective", async () => {
    for (const sourceType of ["manual", "paid_order"] as const) {
      const fixture = await createFixture();
      if (sourceType === "manual") {
        await insertManualGrant(fixture, NOW);
      } else {
        await insertPaidGrant(fixture, NOW);
      }

      await expect(
        enrollInFreeCourse({
          courseId: fixture.courseId,
          now: NOW,
          userId: fixture.userId,
        })
      ).resolves.toEqual({ status: "already_active" });
      expect(
        (await getGrantStates(fixture)).some(
          (grant) => grant.source_type === "free_enrollment"
        )
      ).toBe(false);
      await cleanupFixtures();
    }
  });

  it("rejects a price changed to paid before the final Course read", async () => {
    const fixture = await createFixture();
    const locker = await pool.connect();
    let enrollmentAttempt: Promise<unknown> | null = null;

    try {
      await locker.query("begin");
      await lockCourseContentRelease(locker, fixture.courseId);
      enrollmentAttempt = enrollInFreeCourse({
        courseId: fixture.courseId,
        now: NOW,
        userId: fixture.userId,
      });
      await vi.waitFor(
        async () => {
          expect(await isWaitingForAdvisoryLock()).toBe(true);
        },
        { interval: 50, timeout: LOCK_OBSERVATION_TIMEOUT_MS }
      );

      await pool.query(
        "update courses set price_in_cents = 1000 where id = $1",
        [fixture.courseId]
      );
      await locker.query("commit");

      await expect(enrollmentAttempt).rejects.toThrow(
        "Preço diferente de zero."
      );
      expect(await getGrantStates(fixture)).toHaveLength(0);
    } finally {
      if (enrollmentAttempt) {
        await enrollmentAttempt.catch(() => undefined);
      }
      await rollbackQuietly(locker);
      locker.release();
    }
  });

  it("rejects closed, archived, draft, and unpublished Courses", async () => {
    const cases = [
      {
        message: "Estado de vendas fechado.",
        update: "update courses set sales_status = 'closed' where id = $1",
      },
      {
        message: "Curso inexistente, arquivado, draft ou inativo.",
        update:
          "update courses set status = 'archived', catalog_visibility = 'hidden', sales_status = 'closed' where id = $1",
      },
      {
        message: "Curso inexistente, arquivado, draft ou inativo.",
        update:
          "update courses set status = 'draft', catalog_visibility = 'listed', sales_status = 'closed' where id = $1",
      },
      {
        message: "Publicação de Curso ausente.",
        update: "delete from course_publications where course_id = $1",
      },
    ] as const;

    for (const testCase of cases) {
      const fixture = await createFixture();
      await pool.query(testCase.update, [fixture.courseId]);

      await expect(
        enrollInFreeCourse({
          courseId: fixture.courseId,
          now: NOW,
          userId: fixture.userId,
        })
      ).rejects.toThrow(testCase.message);
      await cleanupFixtures();
    }
  });

  it("expires free grants and their enrollment through existing maintenance", async () => {
    const fixture = await createFixture();
    const expiresAt = new Date("2026-09-20T12:00:00.000Z");
    await enrollInFreeCourse({
      courseId: fixture.courseId,
      now: NOW,
      userId: fixture.userId,
    });
    await pool.query(
      `
        update enrollment_grants
        set effective_expires_at = $3, base_expires_at = $3
        where user_id = $1 and course_id = $2 and source_type = 'free_enrollment'
      `,
      [fixture.userId, fixture.courseId, expiresAt]
    );
    await pool.query(
      "update enrollments set expires_at = $3 where user_id = $1 and course_id = $2",
      [fixture.userId, fixture.courseId, expiresAt]
    );

    await expect(
      processEnrollmentMaintenance({
        now: new Date("2026-09-21T12:00:00.000Z"),
      })
    ).resolves.toMatchObject({ expiredCount: 1 });

    const grants = await getGrantStates(fixture);
    expect(grants).toEqual([
      expect.objectContaining({
        source_type: "free_enrollment",
        status: "expired",
      }),
    ]);
    const { rows: enrollments } = await pool.query<{ status: string }>(
      "select status from enrollments where user_id = $1 and course_id = $2",
      [fixture.userId, fixture.courseId]
    );
    expect(enrollments).toEqual([{ status: "expired" }]);
  });

  it("blocks an isolated free grant and revokes its projected enrollment", async () => {
    const fixture = await createFixture();
    await enrollInFreeCourse({
      courseId: fixture.courseId,
      now: NOW,
      userId: fixture.userId,
    });
    const enrollmentId = await getEnrollmentId(fixture);

    await blockEnrollmentAccess({
      actorUserId: fixture.userId,
      enrollmentId,
      now: NOW,
      reason: "Bloqueio de integração",
    });

    expect(await getGrantStates(fixture)).toEqual([
      expect.objectContaining({
        revoked_reason: "manual_access_block",
        source_type: "free_enrollment",
        status: "cancelled",
      }),
    ]);
    const { rows } = await pool.query<{ status: string }>(
      "select status from enrollments where id = $1",
      [enrollmentId]
    );
    expect(rows).toEqual([{ status: "revoked" }]);
  });

  it("blocks paid and free grants together but restores only manual blocks", async () => {
    const fixture = await createFixture();
    await enrollInFreeCourse({
      courseId: fixture.courseId,
      now: NOW,
      userId: fixture.userId,
    });
    const { grantId: paidGrantId } = await insertPaidGrant(fixture, NOW);
    const enrollmentId = await getEnrollmentId(fixture);

    await blockEnrollmentAccess({
      actorUserId: fixture.userId,
      enrollmentId,
      now: NOW,
      reason: "Bloqueio conjunto de integração",
    });
    expect(
      (await getGrantStates(fixture)).every(
        (grant) =>
          grant.status === "cancelled" &&
          grant.revoked_reason === "manual_access_block"
      )
    ).toBe(true);

    await pool.query(
      `
        update enrollment_grants
        set revoked_reason = 'payment_refund', updated_at = now()
        where id = $1
      `,
      [paidGrantId]
    );
    await restoreEnrollmentAccess({
      actorUserId: fixture.userId,
      enrollmentId,
      now: NOW,
      reason: "Restauração parcial de integração",
    });

    const grants = await getGrantStates(fixture);
    expect(grants).toEqual([
      expect.objectContaining({
        revoked_reason: "payment_refund",
        source_type: "paid_order",
        status: "cancelled",
      }),
      expect.objectContaining({
        revoked_reason: null,
        source_type: "free_enrollment",
        status: "active",
      }),
    ]);
  });
});
