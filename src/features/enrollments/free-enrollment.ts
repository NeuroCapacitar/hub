import "server-only";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { assertMaxReleaseDelayFitsAccessDuration } from "@/features/courses/module-content-release";
import { addMonths } from "@/features/enrollments/rules";
import { lockEnrollmentAggregate } from "./enrollment-aggregate-lock";
import { insertEnrollmentEvent, rebuildEnrollmentProjection } from "./server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CourseDeliveryStatus = "active" | "archived" | "draft";
type CourseCatalogVisibility = "hidden" | "listed";
type CourseSalesStatus = "closed" | "open";
type EnrollmentStatus = "active" | "expired" | "revoked";
type EnrollmentGrantStatus =
  | "active"
  | "cancelled"
  | "disputed"
  | "expired"
  | "refunded";

interface FreeEnrollmentCourseRow {
  access_duration_months: number;
  catalog_visibility: CourseCatalogVisibility;
  has_published_publication: boolean;
  id: string;
  max_release_delay_days: number;
  price_in_cents: number;
  sales_status: CourseSalesStatus;
  status: CourseDeliveryStatus;
}

interface EnrollmentRow {
  status: EnrollmentStatus;
}

interface FreeEnrollmentGrantRow {
  effective_expires_at: Date;
  id: string;
  revoked_reason: string | null;
  starts_at: Date;
  status: EnrollmentGrantStatus;
}

interface EffectiveGrantRow {
  id: string;
}

export type FreeEnrollmentResult =
  | { status: "already_active" }
  | { status: "created" }
  | { status: "reactivated" };

const validateCourseId = (courseId: string): string => {
  if (typeof courseId !== "string") {
    throw new Error("Curso inválido.");
  }

  const normalizedCourseId = courseId.trim();
  if (!UUID_PATTERN.test(normalizedCourseId)) {
    throw new Error("Curso inválido.");
  }

  return normalizedCourseId;
};

const readCourseForFreeEnrollment = async (
  client: PoolClient,
  courseId: string
): Promise<FreeEnrollmentCourseRow> => {
  const { rows } = await client.query<FreeEnrollmentCourseRow>(
    `
      select
        c.id,
        c.status,
        c.catalog_visibility,
        c.sales_status,
        c.price_in_cents,
        c.access_duration_months,
        exists (
          select 1
          from course_publications cp
          where cp.course_id = c.id
            and cp.status = 'published'
        ) as has_published_publication,
        coalesce((
          select max(m.release_delay_days)
          from modules m
          join course_publications cp on cp.id = m.course_publication_id
          where cp.course_id = c.id
            and cp.status = 'published'
            and m.status = 'active'
        ), 0)::int as max_release_delay_days
      from courses c
      where c.id = $1
      limit 1
      for update
    `,
    [courseId]
  );
  const course = rows[0];

  if (!course) {
    throw new Error("Curso inexistente, arquivado, draft ou inativo.");
  }

  if (course.status !== "active" || course.catalog_visibility !== "listed") {
    throw new Error("Curso inexistente, arquivado, draft ou inativo.");
  }
  if (course.sales_status !== "open") {
    throw new Error("Estado de vendas fechado.");
  }
  if (!course.has_published_publication) {
    throw new Error("Publicação de Curso ausente.");
  }
  if (course.price_in_cents !== 0) {
    throw new Error("Preço diferente de zero.");
  }
  if (
    !Number.isSafeInteger(course.access_duration_months) ||
    course.access_duration_months <= 0
  ) {
    throw new Error("Duração de acesso inválida.");
  }

  try {
    assertMaxReleaseDelayFitsAccessDuration({
      accessDurationMonths: course.access_duration_months,
      maxReleaseDelayDays: course.max_release_delay_days,
    });
  } catch {
    throw new Error("Cronograma incompatível.");
  }

  return course;
};

const readEnrollment = async (
  client: PoolClient,
  userId: string,
  courseId: string
): Promise<EnrollmentRow | null> => {
  const { rows } = await client.query<EnrollmentRow>(
    `
      select status
      from enrollments
      where user_id = $1
        and course_id = $2
      limit 1
      for update
    `,
    [userId, courseId]
  );

  return rows[0] ?? null;
};

const readFreeEnrollmentGrant = async (
  client: PoolClient,
  userId: string,
  courseId: string
): Promise<FreeEnrollmentGrantRow | null> => {
  const { rows } = await client.query<FreeEnrollmentGrantRow>(
    `
      select
        id,
        status,
        starts_at,
        effective_expires_at,
        revoked_reason
      from enrollment_grants
      where user_id = $1
        and course_id = $2
        and source_type = 'free_enrollment'
      limit 1
      for update
    `,
    [userId, courseId]
  );

  return rows[0] ?? null;
};

const hasEffectiveAccessGrant = async (
  client: PoolClient,
  userId: string,
  courseId: string,
  now: Date
): Promise<boolean> => {
  const { rows } = await client.query<EffectiveGrantRow>(
    `
      select id
      from enrollment_grants
      where user_id = $1
        and course_id = $2
        and status = 'active'
        and starts_at <= $3
        and effective_expires_at >= $3
      limit 1
    `,
    [userId, courseId, now]
  );

  return Boolean(rows[0]);
};

const isTerminalGrantStatus = (status: EnrollmentGrantStatus): boolean =>
  status === "cancelled" || status === "disputed" || status === "refunded";

const isExpiredFreeGrant = ({
  grant,
  now,
}: {
  grant: FreeEnrollmentGrantRow;
  now: Date;
}): boolean =>
  grant.status === "expired" ||
  (grant.status === "active" && grant.effective_expires_at < now);

const insertOrReactivateFreeGrant = async ({
  client,
  courseId,
  expiresAt,
  now,
  userId,
}: {
  client: PoolClient;
  courseId: string;
  expiresAt: Date;
  now: Date;
  userId: string;
}): Promise<string> => {
  const { rows } = await client.query<{ id: string }>(
    `
      insert into enrollment_grants (
        user_id,
        course_id,
        source_type,
        order_id,
        manual_reference,
        status,
        starts_at,
        base_expires_at,
        effective_expires_at,
        revoked_at,
        revoked_reason
      )
      values ($1, $2, 'free_enrollment', null, null, 'active', $3, $4, $4, null, null)
      on conflict (user_id, course_id) where source_type = 'free_enrollment'
      do update set
        status = 'active',
        starts_at = excluded.starts_at,
        base_expires_at = excluded.base_expires_at,
        effective_expires_at = excluded.effective_expires_at,
        revoked_at = null,
        revoked_reason = null,
        updated_at = now()
      returning id
    `,
    [userId, courseId, now, expiresAt]
  );
  const grantId = rows[0]?.id;

  if (!grantId) {
    throw new Error("Não foi possível conceder o acesso gratuito.");
  }

  return grantId;
};

export const enrollInFreeCourse = async ({
  courseId,
  now = new Date(),
  userId,
}: {
  courseId: string;
  now?: Date;
  userId: string;
}): Promise<FreeEnrollmentResult> => {
  const normalizedCourseId = validateCourseId(courseId);

  if (!(now instanceof Date && Number.isFinite(now.getTime()))) {
    throw new Error("Data de acesso inválida.");
  }

  const client = await getPool().connect();

  try {
    await client.query("begin");
    await lockEnrollmentAggregate(client, userId, normalizedCourseId);

    const course = await readCourseForFreeEnrollment(
      client,
      normalizedCourseId
    );
    const enrollment = await readEnrollment(client, userId, normalizedCourseId);
    if (enrollment?.status === "revoked") {
      throw new Error("Matrícula revogada não pode receber novo acesso.");
    }

    const freeGrant = await readFreeEnrollmentGrant(
      client,
      userId,
      normalizedCourseId
    );
    if (
      await hasEffectiveAccessGrant(client, userId, normalizedCourseId, now)
    ) {
      await client.query("commit");
      return { status: "already_active" };
    }

    if (freeGrant && isTerminalGrantStatus(freeGrant.status)) {
      throw new Error("Concessão gratuita encerrada não pode ser reativada.");
    }

    const reactivated = freeGrant
      ? isExpiredFreeGrant({ grant: freeGrant, now })
      : false;
    if (freeGrant && !reactivated) {
      throw new Error("Concessão gratuita existente não pode ser substituída.");
    }

    const expiresAt = addMonths(now, course.access_duration_months);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
      throw new Error("Duração de acesso inválida.");
    }

    const grantId = await insertOrReactivateFreeGrant({
      client,
      courseId: normalizedCourseId,
      expiresAt,
      now,
      userId,
    });
    await insertEnrollmentEvent(client, {
      courseId: normalizedCourseId,
      eventType: "free_enrollment_granted",
      grantId,
      metadata: {
        accessDurationMonths: course.access_duration_months,
        expiresAt: expiresAt.toISOString(),
        previousExpiresAt:
          freeGrant?.effective_expires_at.toISOString() ?? null,
        previousStartsAt: freeGrant?.starts_at.toISOString() ?? null,
        reactivated,
        startsAt: now.toISOString(),
      },
      userId,
    });
    await rebuildEnrollmentProjection({
      client,
      courseId: normalizedCourseId,
      now,
      userId,
    });

    await client.query("commit");
    return { status: reactivated ? "reactivated" : "created" };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};
