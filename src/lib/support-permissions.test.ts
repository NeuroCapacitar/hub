import { describe, expect, it } from "vitest";
import {
  DELEGABLE_SUPPORT_PERMISSIONS,
  DELEGABLE_SUPPORT_VIEWS,
  normalizeSupportPermissionGrants,
  normalizeSupportPermissionViews,
  parseSupportPermissionGrants,
  parseSupportPermissionViews,
} from "./support-permissions";

describe("support permissions", () => {
  it("normalizes, deduplicates, and preserves the allowlist order", () => {
    expect(
      normalizeSupportPermissionGrants([
        "reissueCertificates",
        "executeRefund",
        "reissueCertificates",
        "unknownPermission",
      ])
    ).toEqual(["reissueCertificates", "executeRefund"]);
  });

  it("fails closed when a persisted value is not an array", () => {
    expect(normalizeSupportPermissionGrants(null)).toEqual([]);
    expect(normalizeSupportPermissionGrants(undefined)).toEqual([]);
    expect(normalizeSupportPermissionGrants("executeRefund")).toEqual([]);
    expect(normalizeSupportPermissionViews("viewAudit")).toEqual([]);
  });

  it("rejects grants outside the delegable allowlist", () => {
    expect(() =>
      parseSupportPermissionGrants(["executeRefund", "manageStaffAccess"])
    ).toThrow("permissão de Suporte inválida");
  });

  it("accepts an empty list for a new Support account", () => {
    expect(parseSupportPermissionGrants([])).toEqual([]);
  });

  it("keeps the explicit product allowlist small", () => {
    expect(DELEGABLE_SUPPORT_PERMISSIONS).toEqual([
      "createCourse",
      "manageCourseDetails",
      "manageCourseContent",
      "manageCourseAvailability",
      "manageCourseCertificate",
      "manageEnrollmentSupport",
      "manageEnrollmentAccess",
      "reissueCertificates",
      "manageCertificateIssuerProfile",
      "executeRefund",
      "manageFinancialOperations",
      "manageFinancialReviews",
      "manageOperations",
    ]);
  });

  it("normalizes protected views independently from change permissions", () => {
    expect(
      normalizeSupportPermissionViews([
        "viewAudit",
        "viewAudit",
        "viewFinancialOrders",
        "manageCourseContent",
      ])
    ).toEqual(["viewFinancialOrders", "viewAudit"]);
    expect(parseSupportPermissionViews(["viewFinancialReviews"])).toEqual([
      "viewFinancialReviews",
    ]);
    expect(DELEGABLE_SUPPORT_VIEWS).toHaveLength(4);
  });
});
