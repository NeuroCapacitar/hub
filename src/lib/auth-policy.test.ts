import { describe, expect, it } from "vitest";
import {
  type AuthorizationSubject,
  type AuthPermission,
  canPerform,
  getBetterAuthRateLimitConfig,
  getBootstrapAdminDecision,
  getPasswordResetRedirectUrl,
  getResolvedBetterAuthInfraConfig,
  isBlockedAuthEndpoint,
} from "./auth-policy";
import {
  DELEGABLE_SUPPORT_PERMISSIONS,
  DELEGABLE_SUPPORT_VIEWS,
} from "./support-permissions";

describe("auth policy", () => {
  it("blocks public email sign-up by default", () => {
    expect(
      isBlockedAuthEndpoint({
        allowPublicSignUp: false,
        method: "POST",
        pathSegments: ["sign-up", "email"],
      })
    ).toBe(true);
  });

  it("allows Better Auth internal sign-up when explicitly enabled", () => {
    expect(
      isBlockedAuthEndpoint({
        allowPublicSignUp: true,
        method: "POST",
        pathSegments: ["sign-up", "email"],
      })
    ).toBe(false);
  });

  it("requires a bootstrap secret outside production too", () => {
    expect(
      getBootstrapAdminDecision({
        authorization: null,
        nodeEnv: "development",
        secret: undefined,
      })
    ).toEqual({
      allowed: false,
      error: "bootstrap_secret_not_configured",
      status: 503,
    });
  });

  it("accepts bootstrap only with the configured bearer token", () => {
    expect(
      getBootstrapAdminDecision({
        authorization: "Bearer local-secret",
        nodeEnv: "development",
        secret: "local-secret",
      })
    ).toEqual({ allowed: true });
  });

  it("uses the canonical app url for password reset redirects", () => {
    expect(
      getPasswordResetRedirectUrl({
        appUrl: "https://hub.example.com/app",
        fallbackOrigin: "https://attacker.example.com",
      })
    ).toBe("https://hub.example.com/redefinir-senha");
  });

  it("falls back to the current origin when the canonical app url is invalid", () => {
    expect(
      getPasswordResetRedirectUrl({
        appUrl: "invalid-url",
        fallbackOrigin: "https://preview.example.com/app",
      })
    ).toBe("https://preview.example.com/redefinir-senha");
  });

  const permissions = [
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
    "manageFaq",
    "manageFinancialOperations",
    "manageFinancialReviews",
    "manageLearningAnalytics",
    "manageOperations",
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
    "viewScopedAudit",
    "viewSettings",
    "viewStudentOperations",
    "viewStudents",
  ] as const;

  const supportDefaultPermissions = new Set<(typeof permissions)[number]>([
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
  ]);
  const supportReadPermissions = new Set<(typeof permissions)[number]>([
    ...supportDefaultPermissions,
    "viewAudit",
    "viewFinancialAnalysis",
    "viewFinancialOrders",
    "viewFinancialReviews",
    "viewFinancials",
    "viewScopedAudit",
  ]);

  const getSubject = (
    role: "admin" | "support" | "student",
    grants: AuthorizationSubject["supportPermissionGrants"] = [],
    views: AuthorizationSubject["supportPermissionViews"] = role === "support"
      ? DELEGABLE_SUPPORT_VIEWS
      : []
  ): AuthorizationSubject => ({
    role,
    supportPermissionGrants: grants,
    supportPermissionViews: views,
  });

  const permissionCases = (["admin", "support", "student"] as const).flatMap(
    (role) =>
      permissions.map(
        (permission) =>
          [
            role,
            permission,
            role === "admin" ||
              (role === "support" && supportReadPermissions.has(permission)) ||
              (role === "support" && supportDefaultPermissions.has(permission)),
          ] as const
      )
  );

  it.each(
    permissionCases
  )("authorizes role %s for %s as %s", (role, permission, expected) => {
    expect(canPerform(getSubject(role), permission as AuthPermission)).toBe(
      expected
    );
  });

  it.each(
    DELEGABLE_SUPPORT_PERMISSIONS
  )("authorizes Support when Admin grants %s", (permission) => {
    expect(canPerform(getSubject("support", [permission]), permission)).toBe(
      true
    );
  });

  it("does not let a Support grant authorize another mutation", () => {
    expect(
      canPerform(getSubject("support", ["executeRefund"]), "manageContent")
    ).toBe(false);
  });

  it("keeps the panel and standard areas available without grants", () => {
    const supportWithoutGrants = getSubject("support", [], []);

    expect(canPerform(supportWithoutGrants, "viewAdminPanel")).toBe(true);
    expect(canPerform(supportWithoutGrants, "viewLearningAnalytics")).toBe(
      true
    );
    expect(canPerform(supportWithoutGrants, "viewCourses")).toBe(true);
    expect(canPerform(supportWithoutGrants, "manageFaq")).toBe(true);
    expect(canPerform(supportWithoutGrants, "viewFinancials")).toBe(false);
    expect(canPerform(supportWithoutGrants, "viewAudit")).toBe(false);
  });

  it("limits protected Support reads to the selected financial views", () => {
    const ordersOnly = getSubject("support", [], ["viewFinancialOrders"]);

    expect(canPerform(ordersOnly, "viewFinancialOrders")).toBe(true);
    expect(canPerform(ordersOnly, "viewFinancialAnalysis")).toBe(false);
    expect(canPerform(ordersOnly, "viewFinancialReviews")).toBe(false);
    expect(canPerform(ordersOnly, "viewFinancials")).toBe(true);
    expect(canPerform(ordersOnly, "viewStudents")).toBe(true);
    expect(canPerform(ordersOnly, "viewScopedAudit")).toBe(false);
  });

  it("requires the related protected view before a financial change", () => {
    const supportWithRefund = getSubject(
      "support",
      ["executeRefund"],
      ["viewFinancialOrders"]
    );

    expect(canPerform(supportWithRefund, "executeRefund")).toBe(true);
    expect(
      canPerform(getSubject("support", ["executeRefund"], []), "executeRefund")
    ).toBe(false);
  });

  it("uses standard course visibility for delegated course changes", () => {
    expect(
      canPerform(
        getSubject("support", ["manageCourseContent"], []),
        "manageCourseContent"
      )
    ).toBe(true);
  });

  it("enables Better Auth infra only when an api key is configured", () => {
    expect(
      getResolvedBetterAuthInfraConfig({
        apiKey: undefined,
        apiUrl: undefined,
        kvUrl: undefined,
      })
    ).toBeNull();

    expect(
      getResolvedBetterAuthInfraConfig({
        apiKey: "dash-key",
        apiUrl: "https://api.example.com",
        kvUrl: "https://kv.example.com",
      })
    ).toEqual({
      apiKey: "dash-key",
      apiUrl: "https://api.example.com",
      kvUrl: "https://kv.example.com",
    });
  });

  it("disables Better Auth infra for isolated E2E fixtures", () => {
    expect(
      getResolvedBetterAuthInfraConfig({
        apiKey: "dash-key",
        apiUrl: "https://api.example.com",
        isE2eTestMode: true,
        kvUrl: "https://kv.example.com",
      })
    ).toBeNull();
  });

  it("raises sign-in and password reset limits in isolated E2E mode", () => {
    expect(getBetterAuthRateLimitConfig(false)).toBeUndefined();
    expect(getBetterAuthRateLimitConfig(true)).toEqual({
      customRules: {
        "/request-password-reset": { max: 100, window: 10 },
        "/sign-in/email": { max: 100, window: 10 },
      },
    });
  });
});
