import { describe, expect, it } from "vitest";
import { parseStaffAccessCommand } from "./staff-command-input";

const createFormData = (
  values: Record<string, string | readonly string[]>
): FormData => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") {
      formData.set(key, value);
    } else {
      for (const item of value) {
        formData.append(key, item);
      }
    }
  }
  return formData;
};

describe("staff access command input", () => {
  it("accepts a Support allowlist with a required reason", () => {
    expect(
      parseStaffAccessCommand(
        createFormData({
          reason: "Revisão trimestral de acesso",
          role: "support",
          supportPermissionGrants: ["executeRefund", "reissueCertificates"],
          supportPermissionViews: ["viewFinancialOrders", "viewAudit"],
          targetUserId: "user-1",
        })
      )
    ).toEqual({
      grants: ["reissueCertificates", "executeRefund"],
      reason: "Revisão trimestral de acesso",
      role: "support",
      targetUserId: "user-1",
      views: ["viewFinancialOrders", "viewAudit"],
    });
  });

  it("deduplicates repeated grants through the parser", () => {
    expect(
      parseStaffAccessCommand(
        createFormData({
          reason: "Revisão de função",
          role: "support",
          supportPermissionGrants: ["executeRefund", "executeRefund"],
          supportPermissionViews: ["viewFinancialOrders"],
          targetUserId: "user-1",
        })
      ).grants
    ).toEqual(["executeRefund"]);
  });

  it("requires the route view before accepting a change permission", () => {
    expect(() =>
      parseStaffAccessCommand(
        createFormData({
          reason: "Revisão de função",
          role: "support",
          supportPermissionGrants: ["executeRefund"],
          supportPermissionViews: [],
          targetUserId: "user-1",
        })
      )
    ).toThrow("visualização correspondente");
  });

  it("requires the matching protected view for each financial change", () => {
    expect(() =>
      parseStaffAccessCommand(
        createFormData({
          reason: "Revisão de função",
          role: "support",
          supportPermissionGrants: ["manageFinancialReviews"],
          supportPermissionViews: ["viewFinancialOrders"],
          targetUserId: "user-1",
        })
      )
    ).toThrow("visualização correspondente");

    expect(
      parseStaffAccessCommand(
        createFormData({
          reason: "Revisão de função",
          role: "support",
          supportPermissionGrants: ["manageFinancialReviews"],
          supportPermissionViews: ["viewFinancialReviews"],
          targetUserId: "user-1",
        })
      ).grants
    ).toEqual(["manageFinancialReviews"]);
  });

  it("clears grants for admin and student roles", () => {
    expect(
      parseStaffAccessCommand(
        createFormData({
          reason: "Retorno para a operação administrativa",
          role: "admin",
          supportPermissionGrants: [],
          targetUserId: "user-1",
        })
      ).grants
    ).toEqual([]);
  });

  it.each([
    ["invalid role", { role: "owner", reason: "Motivo" }],
    [
      "grant on a non-support role",
      {
        role: "student",
        reason: "Motivo",
        supportPermissionGrants: ["executeRefund"],
      },
    ],
    [
      "unknown grant",
      {
        role: "support",
        reason: "Motivo",
        supportPermissionGrants: ["manageStaffAccess"],
      },
    ],
    ["missing reason", { role: "student", reason: "" }],
  ])("rejects %s", (_label, values) => {
    expect(() =>
      parseStaffAccessCommand(
        createFormData({ targetUserId: "user-1", ...values })
      )
    ).toThrow();
  });

  it("does not accept files as text input", () => {
    const formData = createFormData({
      reason: "Motivo",
      role: "student",
      targetUserId: "user-1",
    });
    formData.set("reason", new File(["secret"], "reason.txt"));

    expect(() => parseStaffAccessCommand(formData)).toThrow("motivo");
  });
});
