import { describe, expect, it } from "vitest";
import {
  parseStaffInvitationId,
  parseStaffInvitationInput,
} from "./staff-invitation-input";

const baseForm = (): FormData => {
  const form = new FormData();
  form.set("email", " TeSt@example.com ");
  form.set("role", "admin");
  form.set("reason", "Contratação aprovada");
  return form;
};

describe("staff invitation input", () => {
  it("accepts an Admin invitation without permissions", () => {
    expect(parseStaffInvitationInput(baseForm())).toEqual({
      email: "TeSt@example.com",
      grants: [],
      reason: "Contratação aprovada",
      role: "admin",
      views: [],
    });
  });

  it("accepts allowlisted Support permissions only when required views exist", () => {
    const form = baseForm();
    form.set("role", "support");
    form.append("supportPermissionGrants", "executeRefund");
    form.append("supportPermissionViews", "viewFinancialOrders");

    expect(parseStaffInvitationInput(form)).toMatchObject({
      grants: ["executeRefund"],
      role: "support",
      views: ["viewFinancialOrders"],
    });

    form.delete("supportPermissionViews");
    expect(() => parseStaffInvitationInput(form)).toThrow(
      "visualização correspondente"
    );
  });

  it("rejects invalid email, student role, unknown permissions and Admin grants", () => {
    const invalidEmail = baseForm();
    invalidEmail.set("email", "not-an-email");
    expect(() => parseStaffInvitationInput(invalidEmail)).toThrow(
      "e-mail válido"
    );

    const studentRole = baseForm();
    studentRole.set("role", "student");
    expect(() => parseStaffInvitationInput(studentRole)).toThrow("inválido");

    const unexpectedGrant = baseForm();
    unexpectedGrant.set("role", "support");
    unexpectedGrant.append("supportPermissionGrants", "manageEverything");
    expect(() => parseStaffInvitationInput(unexpectedGrant)).toThrow(
      "permissão de Suporte inválida"
    );

    const adminGrant = baseForm();
    adminGrant.append("supportPermissionGrants", "manageOperations");
    expect(() => parseStaffInvitationInput(adminGrant)).toThrow(
      "Permissões adicionais"
    );
  });

  it("rejects short reasons and malformed invitation ids", () => {
    const form = baseForm();
    form.set("reason", "x");
    expect(() => parseStaffInvitationInput(form)).toThrow("pelo menos 3");

    const invalidId = new FormData();
    invalidId.set("invitationId", "not-a-uuid");
    expect(() => parseStaffInvitationId(invalidId)).toThrow("convite");
  });
});
