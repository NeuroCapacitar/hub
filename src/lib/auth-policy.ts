import type { AppRole } from "@/lib/session";
import {
  isDelegableSupportPermission,
  isDelegableSupportView,
  SUPPORT_PERMISSION_VIEW_REQUIREMENTS,
  type SupportPermission,
  type SupportViewPermission,
} from "@/lib/support-permissions";

export type AuthPermission =
  | "createCourse"
  | "executeRefund"
  | "exportLearningAnalytics"
  | "manageAuthMedia"
  | "manageBanners"
  | "manageCertificateIssuerProfile"
  | "manageCertificates"
  | "manageContent"
  | "manageCourseAvailability"
  | "manageCourseCertificate"
  | "manageCourseContent"
  | "manageCourseDetails"
  | "manageCourses"
  | "manageEnrollmentAccess"
  | "manageEnrollmentSupport"
  | "manageFinancialOperations"
  | "manageFinancialReviews"
  | "manageLearningAnalytics"
  | "manageOperations"
  | "manageFaq"
  | "manageSettings"
  | "manageStaffAccess"
  | "reissueCertificates"
  | "retryOutbox"
  | "retryWebhook"
  | "viewAdminPanel"
  | "viewAudit"
  | "viewCourseOperations"
  | "viewCourses"
  | "viewFinancialAnalysis"
  | "viewFinancialOrders"
  | "viewFinancialReviews"
  | "viewFinancials"
  | "viewGlobalAudit"
  | "viewLearningAnalytics"
  | "viewOperations"
  | "viewSettings"
  | "viewScopedAudit"
  | "viewStudentOperations"
  | "viewStudents";

export interface AuthorizationSubject {
  role: AppRole;
  supportPermissionGrants: readonly SupportPermission[];
  supportPermissionViews: readonly SupportViewPermission[];
}

const allAdminPermissions: readonly AuthPermission[] = [
  "createCourse",
  "executeRefund",
  "exportLearningAnalytics",
  "manageAuthMedia",
  "manageBanners",
  "manageCertificateIssuerProfile",
  "manageCertificates",
  "manageContent",
  "manageCourseAvailability",
  "manageCourseCertificate",
  "manageCourseContent",
  "manageCourseDetails",
  "manageCourses",
  "manageEnrollmentAccess",
  "manageEnrollmentSupport",
  "manageFinancialOperations",
  "manageFinancialReviews",
  "manageLearningAnalytics",
  "manageOperations",
  "manageFaq",
  "manageSettings",
  "manageStaffAccess",
  "reissueCertificates",
  "retryOutbox",
  "retryWebhook",
  "viewAdminPanel",
  "viewAudit",
  "viewCourseOperations",
  "viewCourses",
  "viewFinancialAnalysis",
  "viewFinancialOrders",
  "viewFinancialReviews",
  "viewFinancials",
  "viewGlobalAudit",
  "viewLearningAnalytics",
  "viewOperations",
  "viewSettings",
  "viewScopedAudit",
  "viewStudentOperations",
  "viewStudents",
] as const;

const supportDefaultPermissions: readonly AuthPermission[] = [
  "exportLearningAnalytics",
  "manageAuthMedia",
  "manageBanners",
  "manageFaq",
  "viewAdminPanel",
  "viewCourseOperations",
  "viewCourses",
  "viewLearningAnalytics",
  "viewOperations",
  "viewSettings",
  "viewStudentOperations",
  "viewStudents",
] as const;

const supportDefaultPermissionSet = new Set<AuthPermission>(
  supportDefaultPermissions
);

const supportPermissionRequirements: Readonly<
  Partial<Record<SupportPermission, readonly AuthPermission[]>>
> = {
  createCourse: ["viewCourses"],
  manageCourseAvailability: ["viewCourses"],
  manageCourseCertificate: ["viewCourses"],
  manageCourseContent: ["viewCourses"],
  manageCourseDetails: ["viewCourses"],
  manageCertificateIssuerProfile: ["viewSettings"],
  manageEnrollmentAccess: ["viewCourses", "viewStudents"],
  manageEnrollmentSupport: ["viewCourses", "viewStudents"],
  manageFinancialOperations: ["viewFinancialOrders"],
  manageFinancialReviews: ["viewFinancialReviews"],
  manageOperations: ["viewOperations"],
  reissueCertificates: ["viewCourses", "viewStudents"],
  executeRefund: ["viewFinancialOrders"],
};

const hasSupportView = (
  subject: AuthorizationSubject,
  permission: SupportViewPermission
): boolean => subject.supportPermissionViews?.includes(permission) ?? false;

const hasAnySupportView = (
  subject: AuthorizationSubject,
  permissions: readonly SupportViewPermission[]
): boolean =>
  permissions.some((permission) => hasSupportView(subject, permission));

const hasSupportCapability = (
  subject: AuthorizationSubject,
  permission: AuthPermission
): boolean => {
  if (supportDefaultPermissionSet.has(permission)) {
    return true;
  }

  if (permission === "viewFinancials") {
    return hasAnySupportView(subject, [
      "viewFinancialAnalysis",
      "viewFinancialOrders",
      "viewFinancialReviews",
    ]);
  }

  return isDelegableSupportView(permission)
    ? hasSupportView(subject, permission)
    : false;
};

export const canPerform = (
  subject: AuthorizationSubject,
  permission: AuthPermission
): boolean => {
  if (subject.role === "admin") {
    return allAdminPermissions.includes(permission);
  }

  if (subject.role !== "support") {
    return false;
  }

  if (hasSupportCapability(subject, permission)) {
    return true;
  }

  if (permission === "viewScopedAudit") {
    return (
      hasSupportView(subject, "viewAudit") &&
      hasSupportCapability(subject, "viewStudents")
    );
  }

  if (!isDelegableSupportPermission(permission)) {
    return false;
  }

  const requiredViews = supportPermissionRequirements[permission] ?? [];
  return (
    subject.supportPermissionGrants.includes(permission) &&
    requiredViews.every((requiredPermission) =>
      hasSupportCapability(subject, requiredPermission)
    ) &&
    (SUPPORT_PERMISSION_VIEW_REQUIREMENTS[permission] ?? []).every((view) =>
      hasSupportView(subject, view)
    )
  );
};

export const hasAdminSurfaceAccess = (subject: AuthorizationSubject): boolean =>
  subject.role === "admin" || subject.role === "support";

export const getAdminLandingPath = (
  subject: AuthorizationSubject
): string | null => {
  if (subject.role === "admin" || subject.role === "support") {
    return "/admin";
  }

  return null;
};

export const isBlockedAuthEndpoint = ({
  allowPublicSignUp,
  method,
  pathSegments,
}: {
  allowPublicSignUp: boolean;
  method: string;
  pathSegments: string[];
}): boolean =>
  !allowPublicSignUp &&
  method.toUpperCase() === "POST" &&
  pathSegments.join("/") === "sign-up/email";

export const getBootstrapAdminDecision = ({
  authorization,
  nodeEnv,
  secret,
}: {
  authorization: string | null;
  nodeEnv: "development" | "production" | "test";
  secret: string | undefined;
}):
  | { allowed: true }
  | { allowed: false; error: string; status: 401 | 404 | 503 } => {
  if (nodeEnv === "production") {
    return { allowed: false, error: "not_found", status: 404 };
  }

  if (!secret) {
    return {
      allowed: false,
      error: "bootstrap_secret_not_configured",
      status: 503,
    };
  }

  if (authorization !== `Bearer ${secret}`) {
    return { allowed: false, error: "unauthorized", status: 401 };
  }

  return { allowed: true };
};

export const getPasswordResetRedirectUrl = ({
  appUrl,
  fallbackOrigin,
}: {
  appUrl: string | undefined;
  fallbackOrigin: string;
}): string => {
  const getOrigin = (url: string): string | null => {
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  };

  const origin =
    (appUrl ? getOrigin(appUrl) : null) ?? getOrigin(fallbackOrigin);

  if (!origin) {
    throw new Error("A valid password reset redirect origin is required.");
  }

  return new URL("/redefinir-senha", origin).toString();
};

export interface BetterAuthInfraConfig {
  apiKey: string;
  apiUrl?: string;
  kvUrl?: string;
}

const E2E_SIGN_IN_RATE_LIMIT = {
  max: 100,
  window: 10,
} as const;
const E2E_PASSWORD_RESET_RATE_LIMIT = {
  max: 100,
  window: 10,
} as const;

export const getBetterAuthRateLimitConfig = (
  isE2eTestMode: boolean
):
  | {
      customRules: {
        "/request-password-reset": typeof E2E_PASSWORD_RESET_RATE_LIMIT;
        "/sign-in/email": typeof E2E_SIGN_IN_RATE_LIMIT;
      };
    }
  | undefined =>
  isE2eTestMode
    ? {
        customRules: {
          "/request-password-reset": E2E_PASSWORD_RESET_RATE_LIMIT,
          "/sign-in/email": E2E_SIGN_IN_RATE_LIMIT,
        },
      }
    : undefined;

export const getResolvedBetterAuthInfraConfig = ({
  apiKey,
  apiUrl,
  isE2eTestMode,
  kvUrl,
}: {
  apiKey: string | undefined;
  apiUrl: string | undefined;
  isE2eTestMode?: boolean;
  kvUrl: string | undefined;
}): BetterAuthInfraConfig | null => {
  if (!apiKey || isE2eTestMode) {
    return null;
  }

  return {
    apiKey,
    ...(apiUrl ? { apiUrl } : {}),
    ...(kvUrl ? { kvUrl } : {}),
  };
};
