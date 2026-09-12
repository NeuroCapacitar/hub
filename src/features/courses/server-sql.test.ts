import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  assertProtectedLessonAccess,
  clientQuery,
  connect,
  query,
  release,
  resolveCourseAccess,
  resolveLessonAccess,
  resolveLessonAccessWithClient,
  syncJmvstreamLessonPlayer,
  getJmvstreamAssetsForLesson,
} = vi.hoisted(() => ({
  assertProtectedLessonAccess: vi.fn(),
  clientQuery: vi.fn(),
  connect: vi.fn(),
  query: vi.fn(),
  release: vi.fn(),
  resolveCourseAccess: vi.fn(),
  resolveLessonAccess: vi.fn(),
  resolveLessonAccessWithClient: vi.fn(),
  syncJmvstreamLessonPlayer: vi.fn(),
  getJmvstreamAssetsForLesson: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: () => ({ connect, query }) }));
vi.mock("@/features/enrollments/access", () => ({
  resolveCourseAccess,
  resolveLessonAccess,
  resolveLessonAccessWithClient,
}));
vi.mock("@/features/jmvstream/server", () => ({
  syncJmvstreamLessonPlayer,
}));
vi.mock("@/features/jmvstream/asset-persistence", () => ({
  getJmvstreamAssetsForLesson,
}));
vi.mock("@/features/courses/protected-lesson-access", () => ({
  assertProtectedLessonAccess,
  LessonAccessDeniedError: class LessonAccessDeniedError extends Error {},
}));

import {
  completeLesson,
  getStudentCourseCatalog,
  getStudentCourseOverview,
  getStudentLessonWorkspace,
  recalculateCourseWorkloadHours,
  recordLessonWatchProgress,
} from "./server";

const expiresAt = new Date("2027-01-01T00:00:00.000Z");

const createCourseOverviewRow = ({
  certificateCode = "CERT-1",
  completedAt = null,
  courseThumbnailUrl = null,
  isRequired = true,
  lessonId,
  lessonThumbnailUrl = null,
  lessonSortOrder,
  videoEmbedUrl = null,
  videoExternalId = null,
}: {
  certificateCode?: string | null;
  completedAt?: Date | null;
  courseThumbnailUrl?: string | null;
  isRequired?: boolean;
  lessonId: string;
  lessonThumbnailUrl?: string | null;
  lessonSortOrder: number;
  videoEmbedUrl?: string | null;
  videoExternalId?: string | null;
}) => ({
  certificate_code: certificateCode,
  certificate_enabled: true,
  certificate_render_status: "ready",
  certificate_status: "valid",
  completed_at: completedAt,
  content_release_mode: "full_access",
  content_release_started_at: null,
  course_description: "Description",
  course_id: "course-1",
  course_slug: "course-one",
  course_subtitle: "Subtitle",
  course_title: "Course one",
  duration_seconds: 120,
  expires_at: expiresAt,
  is_required: isRequired,
  lesson_id: lessonId,
  lesson_sort_order: lessonSortOrder,
  lesson_thumbnail_url: lessonThumbnailUrl,
  lesson_title: `Lesson ${lessonSortOrder}`,
  module_description: "Module description",
  module_id: "module-1",
  module_sort_order: 1,
  module_title: "Module one",
  release_delay_days: 0,
  student_name: "Aluno Teste",
  thumbnail_url: courseThumbnailUrl,
  video_embed_url: videoEmbedUrl,
  video_external_id: videoExternalId,
  watched_percent: completedAt ? 100 : 0,
  workload_hours: 1,
});

const createCatalogRow = ({
  completedAt = null,
  isRequired = true,
  lessonId,
  lessonSortOrder,
}: {
  completedAt?: Date | null;
  isRequired?: boolean;
  lessonId: string;
  lessonSortOrder: number;
}) => ({
  access_status: "active" as const,
  catalog_visibility: "listed" as const,
  completed_at: completedAt,
  content_release_mode: "full_access" as const,
  content_release_started_at: null,
  cover_image_json: null,
  course_description: "Description",
  course_id: "course-1",
  course_status: "active" as const,
  decision_now: new Date("2026-01-01T00:00:00.000Z"),
  duration_seconds: 120,
  expires_at: expiresAt,
  is_enrolled: true,
  is_interested: false,
  is_required: isRequired,
  launch_date: null,
  launch_landing_url: null,
  lesson_id: lessonId,
  lesson_sort_order: lessonSortOrder,
  module_id: "module-1",
  module_release_delay_days: 0,
  module_sort_order: 1,
  price_in_cents: 10_000,
  revoked_reason: null,
  sales_status: "open" as const,
  slug: "course-one",
  subtitle: "Subtitle",
  thumbnail_url: null,
  title: "Course one",
  workload_hours: 1,
});

const createLessonRow = ({
  contentReleaseMode = "full_access",
  contentReleaseStartedAt = null,
  completedAt = null,
  decisionNow = new Date("2026-01-01T00:00:00.000Z"),
  isRequired = true,
  lessonId,
  lessonSortOrder,
  moduleId = "module-1",
  moduleSortOrder = 1,
  moduleTitle = "Module one",
  releaseDelayDays = 0,
  videoDurationSeconds = 120,
}: {
  contentReleaseMode?: "full_access" | "scheduled";
  contentReleaseStartedAt?: Date | null;
  completedAt?: Date | null;
  decisionNow?: Date;
  isRequired?: boolean;
  lessonId: string;
  lessonSortOrder: number;
  moduleId?: string;
  moduleSortOrder?: number;
  moduleTitle?: string;
  releaseDelayDays?: number;
  videoDurationSeconds?: number;
}) => ({
  completed_at: completedAt,
  content_release_mode: contentReleaseMode,
  content_release_started_at: contentReleaseStartedAt,
  content_json: null,
  course_id: "course-1",
  course_title: "Course one",
  decision_now: decisionNow,
  duration_seconds: 120,
  lesson_description: `Description ${lessonSortOrder}`,
  lesson_id: lessonId,
  lesson_sort_order: lessonSortOrder,
  lesson_title: `Lesson ${lessonSortOrder}`,
  is_required: isRequired,
  module_id: moduleId,
  module_sort_order: moduleSortOrder,
  module_title: moduleTitle,
  release_delay_days: releaseDelayDays,
  video_duration_seconds: videoDurationSeconds,
  video_embed_url: null,
  video_external_id: lessonId === "lesson-2" ? "video-2" : null,
  video_provider: lessonId === "lesson-2" ? "jmvstream" : null,
  watch_current_seconds: null,
  watch_duration_seconds: null,
  watch_max_position_seconds: null,
  watch_percent: null,
});

beforeEach(() => {
  vi.resetAllMocks();
  connect.mockResolvedValue({ query: clientQuery, release });
  resolveCourseAccess.mockResolvedValue(true);
  resolveLessonAccess.mockResolvedValue({
    courseId: "course-1",
    kind: "allowed",
  });
  resolveLessonAccessWithClient.mockResolvedValue({
    courseId: "course-1",
    kind: "allowed",
  });
  syncJmvstreamLessonPlayer.mockResolvedValue({ playerUrl: null });
  getJmvstreamAssetsForLesson.mockResolvedValue([]);
});

describe("student experience reads", () => {
  it("lists catalog-visible Courses and preserves hidden Courses with effective access", async () => {
    query.mockResolvedValue({
      rows: [
        {
          access_status: "none",
          catalog_visibility: "listed",
          completed_at: null,
          cover_image_json: null,
          course_description: "Description",
          course_id: "course-1",
          course_status: "draft",
          duration_seconds: 0,
          expires_at: null,
          is_enrolled: false,
          is_interested: true,
          launch_date: "2026-10-01",
          launch_landing_url: null,
          lesson_id: null,
          price_in_cents: 10_000,
          revoked_reason: null,
          sales_status: "closed",
          slug: "course-one",
          subtitle: "Subtitle",
          thumbnail_url: null,
          title: "Course one",
          workload_hours: 0,
        },
      ],
    });

    await expect(getStudentCourseCatalog("student-1")).resolves.toEqual([
      expect.objectContaining({
        availabilityPreset: "coming_soon",
        isInterested: true,
        launchDate: "2026-10-01",
      }),
    ]);
    expect(query.mock.calls[0]?.[0]).toContain(
      "c.catalog_visibility = 'listed'"
    );
    expect(query.mock.calls[0]?.[0]).toContain("or (");
    expect(query.mock.calls[0]?.[0]).toContain("e.status = 'active'");
    expect(query.mock.calls[0]?.[0]).not.toContain("where c.status = 'active'");
  });

  it("does not point the dashboard at a future scheduled lesson", async () => {
    query.mockResolvedValue({
      rows: [
        {
          access_status: "active",
          catalog_visibility: "listed",
          completed_at: null,
          content_release_mode: "scheduled",
          content_release_started_at: new Date(
            Date.now() - 24 * 60 * 60 * 1000
          ),
          cover_image_json: null,
          course_description: "Description",
          course_id: "course-1",
          course_status: "active",
          duration_seconds: 120,
          expires_at: expiresAt,
          is_enrolled: true,
          is_interested: false,
          launch_date: null,
          launch_landing_url: null,
          lesson_id: "future-lesson",
          lesson_sort_order: 1,
          module_id: "module-future",
          module_release_delay_days: 8,
          module_sort_order: 1,
          price_in_cents: 10_000,
          revoked_reason: null,
          sales_status: "open",
          slug: "course-one",
          subtitle: "Subtitle",
          thumbnail_url: null,
          title: "Course one",
          workload_hours: 1,
        },
      ],
    });

    await expect(getStudentCourseCatalog("student-1")).resolves.toEqual([
      expect.objectContaining({
        nextLessonId: null,
        nextReleaseAt: expect.any(Date),
      }),
    ]);
  });

  it("stores workload on the editable publication without summing retired content", async () => {
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes("select workload_hours_override")) {
        return { rows: [{ workload_hours_override: null }] };
      }
      if (sql.includes("from course_publications")) {
        return {
          rows: [
            {
              id: "publication-draft",
              status: "draft",
              workload_hours_snapshot: 13,
            },
            {
              id: "publication-published",
              status: "published",
              workload_hours_snapshot: 10,
            },
          ],
        };
      }
      if (sql.includes("from lessons l")) {
        return { rows: [{ duration_seconds: 13 * 3600 }] };
      }
      return { rows: [] };
    });

    await expect(recalculateCourseWorkloadHours("course-1")).resolves.toBe(10);

    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("update course_publications"),
      [13, "publication-draft"]
    );
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("update courses"),
      [10, "course-1"]
    );
    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining("where m.course_id = $1"),
      expect.anything()
    );
  });

  it("uses required lessons as the catalog progress denominator", async () => {
    query.mockResolvedValue({
      rows: [
        createCatalogRow({
          completedAt: new Date("2026-01-01T00:00:00.000Z"),
          lessonId: "required-1",
          lessonSortOrder: 1,
        }),
        createCatalogRow({
          completedAt: new Date("2026-01-01T00:00:00.000Z"),
          lessonId: "required-2",
          lessonSortOrder: 2,
        }),
        createCatalogRow({
          completedAt: new Date("2026-01-01T00:00:00.000Z"),
          lessonId: "required-3",
          lessonSortOrder: 3,
        }),
        createCatalogRow({
          isRequired: false,
          lessonId: "optional-1",
          lessonSortOrder: 4,
        }),
      ],
    });

    const [course] = await getStudentCourseCatalog("student-1");

    expect(course).toMatchObject({
      completedCount: 3,
      lessonCount: 4,
      nextLessonId: "optional-1",
      progressPercent: 100,
      totalCount: 3,
    });
  });

  it("assembles an enrolled Course overview with progress and sequence", async () => {
    query.mockResolvedValue({
      rows: [
        createCourseOverviewRow({
          completedAt: new Date("2026-01-01T00:00:00.000Z"),
          lessonId: "lesson-1",
          lessonSortOrder: 1,
        }),
        createCourseOverviewRow({ lessonId: "lesson-2", lessonSortOrder: 2 }),
        createCourseOverviewRow({ lessonId: "lesson-3", lessonSortOrder: 3 }),
      ],
    });

    const overview = await getStudentCourseOverview({
      courseId: "course-1",
      viewer: { role: "student", userId: "student-1" },
    });

    expect(query).toHaveBeenCalledWith(expect.any(String), [
      "student-1",
      "course-1",
    ]);
    expect(overview).toMatchObject({
      certificateCode: "CERT-1",
      certificateStatus: "valid",
      completedCount: 1,
      course: { expiresAt, id: "course-1" },
      isPreview: false,
      nextLessonId: "lesson-2",
      progressPercent: 33,
      studentName: "Aluno Teste",
      totalCount: 3,
    });
    expect(overview?.modules[0]?.lessons).toMatchObject([
      {
        availability: { kind: "available" },
        id: "lesson-1",
        isCompleted: true,
      },
      {
        availability: { kind: "available" },
        id: "lesson-2",
        isCompleted: false,
      },
      {
        availability: { kind: "sequence_locked" },
        id: "lesson-3",
        isCompleted: false,
      },
    ]);
    expect(overview?.modules[0]).toMatchObject({
      completedRequiredLessonCount: 1,
      progressPercent: 33,
      requiredLessonCount: 3,
    });
    expect(query.mock.calls[0]?.[0]).toContain(
      "completed_lesson.curriculum_key = l.curriculum_key"
    );
  });

  it("uses video thumbnails only and keeps the course cover available as fallback", async () => {
    query.mockResolvedValue({
      rows: [
        createCourseOverviewRow({
          courseThumbnailUrl: "/course-cover.webp",
          lessonId: "lesson-video",
          lessonThumbnailUrl: "https://cdn.example/video-thumb.jpg",
          lessonSortOrder: 1,
          videoEmbedUrl: "https://player.jmvstream.com/video",
          videoExternalId: "video-1",
        }),
        createCourseOverviewRow({
          courseThumbnailUrl: "/course-cover.webp",
          lessonId: "lesson-text",
          lessonThumbnailUrl: "https://cdn.example/stale-thumb.jpg",
          lessonSortOrder: 2,
        }),
      ],
    });

    const overview = await getStudentCourseOverview({
      courseId: "course-1",
      viewer: { role: "student", userId: "student-1" },
    });

    expect(overview?.course.thumbnailUrl).toBe("/course-cover.webp");
    expect(overview?.modules[0]?.lessons).toMatchObject([
      {
        hasVideo: true,
        id: "lesson-video",
        thumbnailUrl: "https://cdn.example/video-thumb.jpg",
      },
      { hasVideo: false, id: "lesson-text", thumbnailUrl: null },
    ]);
  });

  it("projects the latest revoked certificate when no valid reissue exists", async () => {
    query.mockResolvedValue({
      rows: [
        {
          ...createCourseOverviewRow({
            completedAt: new Date("2026-01-01T00:00:00.000Z"),
            lessonId: "lesson-1",
            lessonSortOrder: 1,
          }),
          certificate_code: "CERT-REVOKED",
          certificate_status: "revoked",
        },
      ],
    });

    const overview = await getStudentCourseOverview({
      courseId: "course-1",
      viewer: { role: "student", userId: "student-1" },
    });

    expect(overview).toMatchObject({
      certificateCode: "CERT-REVOKED",
      certificateStatus: "revoked",
    });
  });

  it("projects future module lesson metadata while preserving release state", async () => {
    const anchor = new Date("2026-09-04T12:00:00.000Z");
    query.mockResolvedValue({
      rows: [
        createCourseOverviewRow({ lessonId: "lesson-1", lessonSortOrder: 1 }),
        {
          ...createCourseOverviewRow({
            lessonId: "lesson-2",
            lessonSortOrder: 1,
          }),
          content_release_mode: "scheduled",
          content_release_started_at: anchor,
          lesson_title: "Video secreto",
          module_description: "Descripción secreta",
          module_id: "module-future",
          module_sort_order: 2,
          module_title: "Aplicação",
          release_delay_days: 8,
          video_external_id: "secret-video",
        },
        {
          ...createCourseOverviewRow({
            lessonId: "lesson-3",
            lessonSortOrder: 2,
          }),
          content_release_mode: "scheduled",
          content_release_started_at: anchor,
          lesson_title: "Material secreto",
          module_description: "Descripción secreta",
          module_id: "module-future",
          module_sort_order: 2,
          module_title: "Aplicação",
          release_delay_days: 8,
        },
      ],
    });

    const overview = await getStudentCourseOverview({
      courseId: "course-1",
      viewer: { role: "student", userId: "student-1" },
    });
    const futureModule = overview?.modules.find(
      (moduleData) => moduleData.id === "module-future"
    );
    expect(futureModule).toMatchObject({
      availableAt: new Date("2026-09-12T12:00:00.000Z"),
      description: "Descripción secreta",
      lessonCount: 2,
      lessons: [
        {
          availability: {
            availableAt: new Date("2026-09-12T12:00:00.000Z"),
            kind: "time_locked",
          },
          hasVideo: true,
          id: "lesson-2",
          isCompleted: false,
          title: "Video secreto",
        },
        {
          availability: {
            availableAt: new Date("2026-09-12T12:00:00.000Z"),
            kind: "time_locked",
          },
          hasVideo: false,
          id: "lesson-3",
          isCompleted: false,
          title: "Material secreto",
        },
      ],
      releaseState: "time_locked",
      totalDurationSeconds: 240,
    });
    expect(JSON.stringify(futureModule)).not.toContain("secret-video");
    expect(overview?.nextReleaseAt).toEqual(
      new Date("2026-09-12T12:00:00.000Z")
    );
  });

  it("keeps a completed lesson revisable inside a future module", async () => {
    const anchor = new Date("2026-09-04T12:00:00.000Z");
    query.mockResolvedValue({
      rows: [
        {
          ...createCourseOverviewRow({
            completedAt: new Date("2026-09-01T12:00:00.000Z"),
            lessonId: "lesson-completed",
            lessonSortOrder: 1,
          }),
          content_release_mode: "scheduled",
          content_release_started_at: anchor,
          module_id: "module-future",
          module_sort_order: 2,
          module_title: "Aplicação",
          release_delay_days: 8,
        },
        {
          ...createCourseOverviewRow({
            lessonId: "lesson-pending",
            lessonSortOrder: 2,
          }),
          content_release_mode: "scheduled",
          content_release_started_at: anchor,
          module_id: "module-future",
          module_sort_order: 2,
          module_title: "Aplicação",
          release_delay_days: 8,
        },
      ],
    });

    const overview = await getStudentCourseOverview({
      courseId: "course-1",
      viewer: { role: "student", userId: "student-1" },
    });
    const futureModule = overview?.modules.find(
      (moduleData) => moduleData.id === "module-future"
    );

    expect(futureModule).toMatchObject({
      lessonCount: 2,
      lessons: [
        { id: "lesson-completed", isCompleted: true },
        { id: "lesson-pending", isCompleted: false },
      ],
      releaseState: "time_locked",
      totalDurationSeconds: 240,
    });
  });

  it("selects a valid reissue before revoked certificate history", async () => {
    query.mockResolvedValue({
      rows: [
        createCourseOverviewRow({
          completedAt: new Date("2026-01-01T00:00:00.000Z"),
          lessonId: "lesson-1",
          lessonSortOrder: 1,
        }),
      ],
    });

    await getStudentCourseOverview({
      courseId: "course-1",
      viewer: { role: "student", userId: "student-1" },
    });

    const sql = query.mock.calls[0]?.[0] as string;
    expect(sql).toContain("left join lateral");
    expect(sql).toContain(
      "case when certificate.status = 'valid' then 0 else 1 end"
    );
    expect(sql).toContain("certificate.issued_at desc");
    expect(sql).not.toContain("and cert.status = 'valid'");
  });

  it("assembles the same Course overview intent as an unrestricted admin preview", async () => {
    query.mockResolvedValue({
      rows: [
        createCourseOverviewRow({
          courseThumbnailUrl: "/course-cover.webp",
          lessonId: "lesson-1",
          lessonThumbnailUrl: "https://cdn.example/video-thumb.jpg",
          lessonSortOrder: 1,
          videoExternalId: "video-1",
        }),
        createCourseOverviewRow({
          isRequired: false,
          lessonId: "lesson-2",
          lessonSortOrder: 2,
        }),
      ],
    });

    const overview = await getStudentCourseOverview({
      courseId: "course-1",
      viewer: { role: "admin", userId: "admin-1" },
    });

    expect(query).toHaveBeenCalledWith(expect.any(String), ["course-1"]);
    expect(overview).toMatchObject({
      certificateCode: null,
      certificateStatus: null,
      completedCount: 0,
      isPreview: true,
      nextLessonId: "lesson-1",
      progressPercent: 0,
      totalCount: 1,
      course: { thumbnailUrl: "/course-cover.webp" },
    });
    expect(overview?.modules[0]?.lessons).toMatchObject([
      {
        availability: { kind: "available" },
        id: "lesson-1",
        isCompleted: false,
        thumbnailUrl: "https://cdn.example/video-thumb.jpg",
      },
      {
        availability: { kind: "available" },
        id: "lesson-2",
        isCompleted: false,
      },
    ]);
  });

  it("enforces lesson sequence for enrolled students", async () => {
    query.mockResolvedValue({
      rows: [
        createLessonRow({ lessonId: "lesson-1", lessonSortOrder: 1 }),
        createLessonRow({ lessonId: "lesson-2", lessonSortOrder: 2 }),
      ],
    });

    await expect(
      getStudentLessonWorkspace({
        lessonId: "lesson-2",
        viewer: { role: "student", userId: "student-1" },
      })
    ).resolves.toEqual({ kind: "unavailable" });

    expect(syncJmvstreamLessonPlayer).not.toHaveBeenCalled();
  });

  it("marks the immediate next lesson as unavailable until the current lesson is completed", async () => {
    query.mockResolvedValue({
      rows: [
        createLessonRow({ lessonId: "lesson-1", lessonSortOrder: 1 }),
        createLessonRow({ lessonId: "lesson-2", lessonSortOrder: 2 }),
      ],
    });

    const workspace = await getStudentLessonWorkspace({
      lessonId: "lesson-1",
      viewer: { role: "student", userId: "student-1" },
    });

    expect(workspace).toMatchObject({
      data: { nextLessonId: "lesson-2" },
      kind: "available",
    });
    expect(
      workspace.kind === "available" ? workspace.data.modules[0]?.lessons : []
    ).toMatchObject([
      { id: "lesson-1", isAvailable: true },
      { id: "lesson-2", isAvailable: false },
    ]);
  });

  it("releases optional and later required lessons after the previous required lesson", async () => {
    query.mockResolvedValue({
      rows: [
        createLessonRow({
          completedAt: new Date("2026-01-01T00:00:00.000Z"),
          lessonId: "lesson-1",
          lessonSortOrder: 1,
        }),
        createLessonRow({
          isRequired: false,
          lessonId: "lesson-2",
          lessonSortOrder: 2,
        }),
        createLessonRow({
          isRequired: false,
          lessonId: "lesson-3",
          lessonSortOrder: 3,
        }),
        createLessonRow({ lessonId: "lesson-4", lessonSortOrder: 4 }),
        createLessonRow({ lessonId: "lesson-5", lessonSortOrder: 5 }),
      ],
    });

    const workspace = await getStudentLessonWorkspace({
      lessonId: "lesson-4",
      viewer: { role: "student", userId: "student-1" },
    });

    expect(workspace).toMatchObject({ kind: "available" });
    expect(
      workspace.kind === "available" ? workspace.data.modules[0]?.lessons : []
    ).toMatchObject([
      { id: "lesson-1", isAvailable: true },
      { id: "lesson-2", isAvailable: true },
      { id: "lesson-3", isAvailable: true },
      { id: "lesson-4", isAvailable: true },
      { id: "lesson-5", isAvailable: false },
    ]);
  });

  it("chooses a pending optional lesson after all required lessons are complete", async () => {
    query.mockResolvedValue({
      rows: [
        createCourseOverviewRow({
          completedAt: new Date("2026-01-01T00:00:00.000Z"),
          lessonId: "lesson-required-1",
          lessonSortOrder: 1,
        }),
        createCourseOverviewRow({
          isRequired: false,
          lessonId: "lesson-optional-1",
          lessonSortOrder: 2,
        }),
        createCourseOverviewRow({
          completedAt: new Date("2026-01-01T00:00:00.000Z"),
          lessonId: "lesson-required-2",
          lessonSortOrder: 3,
        }),
        createCourseOverviewRow({
          isRequired: false,
          lessonId: "lesson-optional-2",
          lessonSortOrder: 4,
        }),
      ],
    });

    const overview = await getStudentCourseOverview({
      courseId: "course-1",
      viewer: { role: "student", userId: "student-1" },
    });

    expect(overview).toMatchObject({
      nextLessonId: "lesson-optional-1",
      progressPercent: 100,
      totalCount: 2,
    });
  });

  it("does not expose a certificate flow for a course without required lessons", async () => {
    query.mockResolvedValue({
      rows: [
        createCourseOverviewRow({
          certificateCode: null,
          isRequired: false,
          lessonId: "lesson-optional-1",
          lessonSortOrder: 1,
        }),
      ],
    });

    const overview = await getStudentCourseOverview({
      courseId: "course-1",
      viewer: { role: "student", userId: "student-1" },
    });

    expect(overview).toMatchObject({
      certificateEnabled: false,
      completedCount: 0,
      progressPercent: 0,
      totalCount: 0,
    });
  });

  it("keeps future module lessons listed while marking them unavailable", async () => {
    const anchor = new Date("2026-01-01T00:00:00.000Z");
    const decisionNow = new Date("2026-01-02T00:00:00.000Z");
    query.mockResolvedValue({
      rows: [
        createLessonRow({
          completedAt: new Date("2025-12-31T00:00:00.000Z"),
          lessonId: "lesson-1",
          lessonSortOrder: 1,
        }),
        createLessonRow({
          contentReleaseMode: "scheduled",
          contentReleaseStartedAt: anchor,
          decisionNow,
          lessonId: "lesson-future",
          lessonSortOrder: 1,
          moduleId: "module-future",
          moduleSortOrder: 2,
          moduleTitle: "Future module",
          releaseDelayDays: 8,
        }),
      ],
    });

    const workspace = await getStudentLessonWorkspace({
      lessonId: "lesson-1",
      viewer: { role: "student", userId: "student-1" },
    });

    expect(workspace).toMatchObject({ kind: "available" });
    expect(
      workspace.kind === "available"
        ? workspace.data.modules.find((module) => module.id === "module-future")
        : null
    ).toMatchObject({
      availableAt: new Date("2026-01-09T00:00:00.000Z"),
      releaseState: "time_locked",
      lessons: [{ id: "lesson-future", isAvailable: false }],
    });
  });

  it("resolves JMVStream video through the lesson workspace interface", async () => {
    query.mockResolvedValue({
      rows: [
        createLessonRow({
          completedAt: new Date("2026-01-01T00:00:00.000Z"),
          lessonId: "lesson-1",
          lessonSortOrder: 1,
        }),
        createLessonRow({ lessonId: "lesson-2", lessonSortOrder: 2 }),
      ],
    });
    syncJmvstreamLessonPlayer.mockResolvedValue({
      playerUrl: "https://player.example.test/video-2",
    });

    const workspace = await getStudentLessonWorkspace({
      lessonId: "lesson-2",
      viewer: { role: "student", userId: "student-1" },
    });

    expect(syncJmvstreamLessonPlayer).toHaveBeenCalledWith("lesson-2");
    expect(assertProtectedLessonAccess).toHaveBeenCalledWith({
      courseId: "course-1",
      lessonId: "lesson-2",
      userId: "student-1",
    });
    expect(workspace).toMatchObject({
      kind: "available",
      data: {
        isPreview: false,
        lesson: {
          id: "lesson-2",
          videoEmbedUrl: "https://player.example.test/video-2",
        },
        nextLessonId: null,
        previousLessonId: "lesson-1",
        progressPercent: 50,
      },
    });
  });

  it("revalidates lesson access before requesting JMVStream playback", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );
    const workspaceSection = source.slice(
      source.indexOf("const getEnrolledLessonWorkspace"),
      source.indexOf("const getPreviewLessonWorkspace")
    );

    expect(workspaceSection).toContain("revalidateJmvstreamLessonAccess");
  });

  it("uses the database decision clock for temporal workspace projection", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );
    const workspaceSection = source.slice(
      source.indexOf("const getEnrolledLessonWorkspace"),
      source.indexOf("const getPreviewLessonWorkspace")
    );

    expect(workspaceSection).toContain("now() as decision_now");
    expect(workspaceSection).not.toContain("now: new Date()");
  });

  it("exposes a safe failed state when JMVStream cannot process a lesson video", async () => {
    query.mockResolvedValue({
      rows: [
        createLessonRow({
          completedAt: new Date("2026-01-01T00:00:00.000Z"),
          lessonId: "lesson-1",
          lessonSortOrder: 1,
        }),
        createLessonRow({ lessonId: "lesson-2", lessonSortOrder: 2 }),
      ],
    });
    getJmvstreamAssetsForLesson.mockResolvedValue([{ uploadStatus: "failed" }]);

    const workspace = await getStudentLessonWorkspace({
      lessonId: "lesson-2",
      viewer: { role: "student", userId: "student-1" },
    });

    expect(
      workspace.kind === "available"
        ? workspace.data.lesson.videoProcessingState
        : null
    ).toBe("failed");
  });

  it("keeps every preview lesson available while preserving navigation", async () => {
    query.mockResolvedValue({
      rows: [
        createLessonRow({ lessonId: "lesson-1", lessonSortOrder: 1 }),
        createLessonRow({ lessonId: "lesson-2", lessonSortOrder: 2 }),
      ],
    });

    const workspace = await getStudentLessonWorkspace({
      lessonId: "lesson-2",
      viewer: { role: "admin", userId: "admin-1" },
    });

    expect(resolveLessonAccess).not.toHaveBeenCalled();
    expect(workspace).toMatchObject({
      kind: "available",
      data: {
        isPreview: true,
        lesson: { id: "lesson-2", isCompleted: false, watchProgress: null },
        nextLessonId: null,
        previousLessonId: "lesson-1",
        progressPercent: 0,
      },
    });
    expect(
      workspace.kind === "available" ? workspace.data.modules[0]?.lessons : []
    ).toMatchObject([
      { id: "lesson-1", isAvailable: true },
      { id: "lesson-2", isAvailable: true },
    ]);
  });
});

describe("course completion writes", () => {
  it("rejects unrecognized video events before touching the database", async () => {
    await expect(
      recordLessonWatchProgress({
        currentSeconds: 1,
        durationSeconds: 120,
        eventName: "ended",
        lessonId: "lesson-1",
        userId: "student-1",
      })
    ).rejects.toThrow("Evento de video invalido.");
    expect(query).not.toHaveBeenCalled();
  });

  it("does not fail the student flow when the lesson duration is unavailable", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("select m.course_id")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      return { rows: [] };
    });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes("with target_course")) {
        return {
          rows: [
            {
              ...createLessonRow({ lessonId: "lesson-2", lessonSortOrder: 2 }),
              video_duration_seconds: 0,
            },
          ],
        };
      }
      if (sql.includes("from lesson_watch_progress")) {
        return {
          rows: [
            {
              current_seconds: 50,
              duration_seconds: 120,
              max_position_seconds: 50,
              resume_position_seconds: 50,
              validated_position_seconds: 50,
              playing_time_seconds: 50,
              tracking_session_id: "session-1",
              last_event_sequence: 1,
              awaiting_playback_after_seek: false,
              linear_progress_blocked: false,
              tracking_version: 1,
              watched_percent: 42,
            },
          ],
        };
      }
      return { rows: [] };
    });

    await expect(
      recordLessonWatchProgress({
        currentSeconds: 60,
        durationSeconds: 120,
        eventName: "jmvplayerout-status",
        lessonId: "lesson-2",
        userId: "student-1",
      })
    ).resolves.toMatchObject({
      completed: false,
      courseId: "course-1",
      watchedPercent: 42,
    });
    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining("insert into lesson_watch_progress"),
      expect.anything()
    );
  });

  it("revalidates enrollment inside the completion transaction", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );
    const completionSource = source.slice(
      source.indexOf("export const completeLesson"),
      source.indexOf("export const recordLessonWatchProgress")
    );

    expect(completionSource).toContain('await client.query("begin")');
    expect(completionSource).toContain("lockEnrollmentAggregate");
    expect(source).toContain("resolveLessonAccessWithClient");
    expect(
      completionSource.indexOf('await client.query("begin")')
    ).toBeLessThan(completionSource.indexOf("getEnrolledLessonWorkspace"));
  });

  it("directs the student to a pending optional lesson after a required completion", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("select m.course_id")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      return { rows: [] };
    });
    const lessonRows = [
      createLessonRow({ lessonId: "lesson-1", lessonSortOrder: 1 }),
      createLessonRow({
        isRequired: false,
        lessonId: "lesson-2",
        lessonSortOrder: 2,
      }),
      createLessonRow({ lessonId: "lesson-3", lessonSortOrder: 3 }),
    ];
    let workspaceReads = 0;
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes("with target_course")) {
        workspaceReads += 1;
        return {
          rows: lessonRows.map((row) =>
            workspaceReads > 1 && row.lesson_id === "lesson-1"
              ? { ...row, completed_at: new Date("2026-01-01T00:00:00.000Z") }
              : row
          ),
        };
      }
      if (sql.includes("insert into lesson_progress")) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes("count(l.id) filter")) {
        return {
          rows: [
            {
              certificate_id: null,
              completed_lessons: 1,
              course_publication_id: "publication-1",
              course_title: "Course one",
              student_name: "Aluno Teste",
              total_lessons: 2,
              workload_hours: 1,
            },
          ],
        };
      }
      return { rows: [] };
    });

    await expect(
      completeLesson({ userId: "student-1", lessonId: "lesson-1" })
    ).resolves.toMatchObject({
      certificateIssued: false,
      nextLessonId: "lesson-2",
    });

    const progressInsert = clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes("insert into lesson_progress")
    );
    expect(progressInsert?.[1]).toEqual(["student-1", "lesson-1", "manual"]);
  });

  it("does not count a forward skip as validated video progress", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("select m.course_id")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      return { rows: [] };
    });
    const lessonRows = [
      createLessonRow({
        completedAt: new Date("2026-01-01T00:00:00.000Z"),
        lessonId: "lesson-1",
        lessonSortOrder: 1,
      }),
      createLessonRow({
        isRequired: false,
        lessonId: "lesson-2",
        lessonSortOrder: 2,
        videoDurationSeconds: 1000,
      }),
    ];
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes("with target_course")) {
        return { rows: lessonRows };
      }
      if (sql.includes("from lesson_watch_progress")) {
        return {
          rows: [
            {
              awaiting_playback_after_seek: false,
              current_seconds: 30,
              duration_seconds: 1000,
              last_event_sequence: 1,
              linear_progress_blocked: false,
              max_position_seconds: 30,
              playing_time_seconds: 30,
              resume_position_seconds: 30,
              tracking_session_id: "session-1",
              tracking_version: 1,
              validated_position_seconds: 30,
              watched_percent: 3,
            },
          ],
        };
      }
      return { rows: [] };
    });

    await expect(
      recordLessonWatchProgress({
        currentSeconds: 950,
        durationSeconds: 1000,
        eventName: "jmvplayerout-skip",
        eventSequence: 2,
        isPaused: false,
        lessonId: "lesson-2",
        trackingSessionId: "session-1",
        userId: "student-1",
      })
    ).resolves.toMatchObject({
      completed: false,
      watchedPercent: 3,
    });

    const watchInsert = clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes("insert into lesson_watch_progress")
    );
    expect(watchInsert?.[1]).toEqual([
      "student-1",
      "lesson-2",
      950,
      30,
      950,
      30,
      30,
      1000,
      3,
      "jmvplayerout-skip",
      "session-1",
      2,
      true,
      true,
      1,
      false,
    ]);
  });

  it("records playback after a skip without allowing it to complete the lesson", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("select m.course_id")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      return { rows: [] };
    });
    const lessonRows = [
      createLessonRow({
        completedAt: new Date("2026-01-01T00:00:00.000Z"),
        lessonId: "lesson-1",
        lessonSortOrder: 1,
      }),
      createLessonRow({
        isRequired: false,
        lessonId: "lesson-2",
        lessonSortOrder: 2,
        videoDurationSeconds: 1000,
      }),
    ];
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes("with target_course")) {
        return { rows: lessonRows };
      }
      if (sql.includes("from lesson_watch_progress")) {
        return {
          rows: [
            {
              awaiting_playback_after_seek: false,
              current_seconds: 950,
              duration_seconds: 1000,
              last_event_sequence: 2,
              linear_progress_blocked: true,
              max_position_seconds: 950,
              playing_time_seconds: 30,
              resume_position_seconds: 30,
              tracking_session_id: "session-1",
              tracking_version: 1,
              validated_position_seconds: 30,
              watched_percent: 3,
            },
          ],
        };
      }
      return { rows: [] };
    });

    await expect(
      recordLessonWatchProgress({
        currentSeconds: 960,
        durationSeconds: 1000,
        eventName: "jmvplayerout-status",
        eventSequence: 3,
        isPaused: false,
        lessonId: "lesson-2",
        trackingSessionId: "session-1",
        userId: "student-1",
      })
    ).resolves.toMatchObject({
      completed: false,
      watchedPercent: 3,
    });

    expect(
      query.mock.calls.some(
        ([, parameters]) =>
          Array.isArray(parameters) && parameters[0] === "watch_progress"
      )
    ).toBe(true);
  });

  it("locks the certificate lifecycle before progress and completion summary writes", async () => {
    query.mockResolvedValue({
      rows: [createLessonRow({ lessonId: "lesson-1", lessonSortOrder: 1 })],
    });
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes("with target_course")) {
        return {
          rows: [createLessonRow({ lessonId: "lesson-1", lessonSortOrder: 1 })],
        };
      }
      if (sql.includes("count(l.id) filter")) {
        return {
          rows: [
            {
              certificate_id: null,
              completed_lessons: 0,
              course_publication_id: "publication-1",
              course_title: "Course one",
              student_name: "Aluno Teste",
              total_lessons: 0,
              workload_hours: 1,
            },
          ],
        };
      }
      if (sql.includes("insert into lesson_progress")) {
        return { rowCount: 0, rows: [] };
      }
      return { rows: [] };
    });

    await expect(
      completeLesson({ userId: "student-1", lessonId: "lesson-1" })
    ).resolves.toMatchObject({ certificateIssued: false });

    const statements = clientQuery.mock.calls.map(([sql]) => sql as string);
    const lockIndex = statements.findIndex((sql) =>
      sql.includes("pg_advisory_xact_lock")
    );
    const progressIndex = statements.findIndex((sql) =>
      sql.includes("insert into lesson_progress")
    );
    const summaryIndex = statements.findIndex((sql) =>
      sql.includes("count(l.id) filter")
    );

    expect(lockIndex).toBeGreaterThan(-1);
    expect(progressIndex).toBeGreaterThan(lockIndex);
    expect(summaryIndex).toBeGreaterThan(progressIndex);
  });
});
