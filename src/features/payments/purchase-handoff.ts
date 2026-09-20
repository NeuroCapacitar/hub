import "server-only";
import { getPool } from "@/db";
import type { CourseOfferSummaryData } from "@/features/courses/course-offer-summary";
import {
  assertScheduleFitsAccessDuration,
  buildContentReleaseScheduleSnapshot,
  type ContentReleaseScheduleSnapshot,
} from "@/features/courses/module-content-release";
import { getContentReleaseScheduleDigest } from "@/features/courses/module-content-release-digest";
import { assertCheckoutAvailable } from "@/features/payments/checkout-availability";
import { getCourseCoverBlurDataUrl } from "@/features/storage/course-cover";
import { getServerEnv } from "@/lib/env";
import type { AppSession } from "@/lib/session";
import { ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS } from "./asaas";

export type PurchaseHandoffView =
  | {
      courseId: string;
      courseSlug: string;
      courseTitle: string;
      kind: "checkout";
      offer: CourseOfferSummaryData;
      releaseSchedule: ContentReleaseScheduleSnapshot;
      releaseScheduleDigest: string;
    }
  | {
      courseId: string;
      courseSlug: string;
      courseTitle: string;
      kind: "free_enrollment";
      offer: CourseOfferSummaryData;
    }
  | {
      courseId: string;
      courseTitle: string;
      href: string;
      kind: "access";
    }
  | {
      kind: "blocked";
      reason: "account_blocked" | "course_revoked" | "team_account";
    }
  | {
      acceptsInterest: true;
      courseId: string;
      courseTitle: string;
      isInterested: boolean;
      kind: "sales_closed";
    }
  | {
      acceptsInterest: true;
      courseId: string;
      courseTitle: string;
      isInterested: boolean;
      kind: "coming_soon";
      launchDate: string | null;
    }
  | {
      href: string;
      kind: "external_redirect";
    }
  | {
      kind: "unavailable";
      reason: "checkout_disabled" | "course_unavailable";
    };

interface PurchaseHandoffRow {
  access_duration_months: number;
  catalog_visibility: "hidden" | "listed";
  certificate_enabled: boolean;
  course_description: string | null;
  course_id: string;
  course_slug: string;
  course_title: string;
  cover_image_json: unknown;
  enrollment_status: "active" | "expired" | "revoked" | null;
  has_effective_access: boolean;
  has_published_publication: boolean;
  is_interested: boolean;
  launch_date: string | null;
  launch_landing_url: string | null;
  lesson_count: number;
  module_count: number;
  payment_allow_credit_card: boolean;
  payment_allow_pix: boolean;
  payment_max_installment_count: number;
  price_in_cents: number;
  release_modules: Array<{
    releaseDelayDays: number;
    sortOrder: number;
    title: string;
  }> | null;
  required_lesson_count: number;
  sales_status: "closed" | "open";
  status: "active" | "archived" | "draft";
  thumbnail_url: string | null;
  workload_hours: number;
}

const PURCHASE_HANDOFF_QUERY = `
  select c.id as course_id,
    c.description as course_description,
    c.slug as course_slug,
    c.title as course_title,
    c.cover_image_json,
    c.certificate_enabled,
    c.status,
    c.catalog_visibility,
    c.sales_status,
    c.launch_date,
    c.launch_landing_url,
    c.price_in_cents,
    c.access_duration_months,
    c.payment_allow_credit_card,
    c.payment_allow_pix,
    c.payment_max_installment_count,
    c.thumbnail_url,
    coalesce(c.workload_hours_override, c.workload_hours) as workload_hours,
    coalesce(content.lesson_count, 0) as lesson_count,
    coalesce(content.module_count, 0) as module_count,
    coalesce(content.required_lesson_count, 0) as required_lesson_count,
    coalesce((
      select json_agg(
        json_build_object(
          'title', m.title,
          'sortOrder', m.sort_order,
          'releaseDelayDays', m.release_delay_days
        ) order by m.sort_order asc
      )
      from modules m
      join course_publications cp_release
        on cp_release.id = m.course_publication_id
      where cp_release.course_id = c.id
        and cp_release.status = 'published'
        and m.status = 'active'
    ), '[]'::json) as release_modules,
    exists (
      select 1
      from course_publications cp
      where cp.course_id = c.id
        and cp.status = 'published'
    ) as has_published_publication,
    e.status as enrollment_status,
    case
      when e.status = 'active'
       and e.starts_at <= now()
       and (e.expires_at is null or e.expires_at >= now())
      then true
      else false
    end as has_effective_access
    ,exists (
      select 1
      from course_sale_interests csi
      where csi.course_id = c.id and csi.user_id = $2
    ) as is_interested
  from courses c
  left join enrollments e
    on e.course_id = c.id
   and e.user_id = $2
  left join lateral (
    select
      count(distinct m.id)::int as module_count,
      count(l.id)::int as lesson_count,
      (count(l.id) filter (where coalesce(l.is_required, true)))::int as required_lesson_count
    from modules m
    join course_publications cp_content
      on cp_content.id = m.course_publication_id
     and cp_content.status = 'published'
    left join lessons l
      on l.module_id = m.id
     and l.course_publication_id = cp_content.id
     and l.status = 'active'
    where cp_content.course_id = c.id
      and m.status = 'active'
  ) content on true
  where c.slug = $1
  limit 1
`;

const getPurchaseOfferSummary = (
  course: PurchaseHandoffRow
): CourseOfferSummaryData => ({
  accessDurationMonths: course.access_duration_months,
  certificateEnabled:
    course.certificate_enabled && course.required_lesson_count > 0,
  coverBlurDataUrl: getCourseCoverBlurDataUrl(course.cover_image_json),
  description: course.course_description,
  lessonCount: course.lesson_count,
  moduleCount: course.module_count,
  paymentAllowCreditCard: course.payment_allow_credit_card,
  paymentAllowPix: course.payment_allow_pix,
  paymentMaxInstallmentCount: course.payment_max_installment_count,
  priceInCents: course.price_in_cents,
  thumbnailUrl: course.thumbnail_url,
  title: course.course_title,
  workloadHours: course.workload_hours,
});

const resolveOpenCheckoutView = (
  course: PurchaseHandoffRow
): Extract<
  PurchaseHandoffView,
  { kind: "checkout" } | { kind: "free_enrollment" } | { kind: "unavailable" }
> => {
  if (
    course.status !== "active" ||
    course.catalog_visibility !== "listed" ||
    course.sales_status !== "open" ||
    !course.has_published_publication
  ) {
    return { kind: "unavailable", reason: "course_unavailable" };
  }

  if (course.price_in_cents === 0) {
    try {
      const releaseSchedule = buildContentReleaseScheduleSnapshot(
        course.release_modules ?? []
      );
      assertScheduleFitsAccessDuration({
        accessDurationMonths: course.access_duration_months,
        snapshot: releaseSchedule,
      });
    } catch {
      return { kind: "unavailable", reason: "course_unavailable" };
    }

    return {
      courseId: course.course_id,
      courseSlug: course.course_slug,
      courseTitle: course.course_title,
      kind: "free_enrollment",
      offer: getPurchaseOfferSummary(course),
    };
  }

  if (course.price_in_cents < ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS) {
    return { kind: "unavailable", reason: "course_unavailable" };
  }

  try {
    assertCheckoutAvailable({
      entry: "public",
      mode: getServerEnv().PAYMENTS_CHECKOUT_MODE,
    });
  } catch {
    return { kind: "unavailable", reason: "checkout_disabled" };
  }

  const releaseSchedule = buildContentReleaseScheduleSnapshot(
    course.release_modules ?? []
  );
  try {
    assertScheduleFitsAccessDuration({
      accessDurationMonths: course.access_duration_months,
      snapshot: releaseSchedule,
    });
  } catch {
    return { kind: "unavailable", reason: "course_unavailable" };
  }

  return {
    courseId: course.course_id,
    courseSlug: course.course_slug,
    courseTitle: course.course_title,
    kind: "checkout",
    offer: getPurchaseOfferSummary(course),
    releaseSchedule,
    releaseScheduleDigest: getContentReleaseScheduleDigest(releaseSchedule),
  };
};

export const getPurchaseHandoffView = async ({
  session,
  slug,
}: {
  session: AppSession | null;
  slug: string;
}): Promise<PurchaseHandoffView> => {
  const { rows } = await getPool().query<PurchaseHandoffRow>(
    PURCHASE_HANDOFF_QUERY,
    [slug, session?.user.id ?? null]
  );
  const course = rows[0];

  if (!course || course.status === "archived") {
    return { kind: "unavailable", reason: "course_unavailable" };
  }

  if (session?.role === "admin" || session?.role === "support") {
    return { kind: "blocked", reason: "team_account" };
  }

  if (session?.platformBlockedAt) {
    return { kind: "blocked", reason: "account_blocked" };
  }

  if (course.enrollment_status === "revoked") {
    return { kind: "blocked", reason: "course_revoked" };
  }

  if (session && course.has_effective_access) {
    return {
      courseId: course.course_id,
      courseTitle: course.course_title,
      href: `/app/cursos/${course.course_id}`,
      kind: "access",
    };
  }

  if (
    course.status === "draft" &&
    course.catalog_visibility === "listed" &&
    course.sales_status === "closed"
  ) {
    if (course.launch_landing_url) {
      return { href: course.launch_landing_url, kind: "external_redirect" };
    }
    return {
      acceptsInterest: true,
      courseId: course.course_id,
      courseTitle: course.course_title,
      isInterested: course.is_interested,
      kind: "coming_soon",
      launchDate: course.launch_date,
    };
  }

  if (course.status === "active" && course.sales_status === "closed") {
    if (course.launch_landing_url) {
      return { href: course.launch_landing_url, kind: "external_redirect" };
    }
    return {
      acceptsInterest: true,
      courseId: course.course_id,
      courseTitle: course.course_title,
      isInterested: course.is_interested,
      kind: "sales_closed",
    };
  }

  return resolveOpenCheckoutView(course);
};
