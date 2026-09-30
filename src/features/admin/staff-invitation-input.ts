import { z } from "zod";
import {
  parseSupportPermissionGrants,
  parseSupportPermissionViews,
  SUPPORT_PERMISSION_VIEW_REQUIREMENTS,
  type SupportPermission,
  type SupportViewPermission,
} from "@/lib/support-permissions";

export const STAFF_INVITATION_ROLES = ["admin", "support"] as const;
export type StaffInvitationRole = (typeof STAFF_INVITATION_ROLES)[number];

export interface StaffInvitationInput {
  email: string;
  grants: SupportPermission[];
  reason: string;
  role: StaffInvitationRole;
  views: SupportViewPermission[];
}

const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 500;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailSchema = z.string().trim().min(1).max(254).email();

const readText = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const readList = (formData: FormData, key: string): string[] =>
  formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value : value.name));

const grantRequiresView = (
  grant: SupportPermission,
  views: readonly SupportViewPermission[]
): boolean =>
  (SUPPORT_PERMISSION_VIEW_REQUIREMENTS[grant] ?? []).every((view) =>
    views.includes(view)
  );

export const parseStaffInvitationInput = (
  formData: FormData
): StaffInvitationInput => {
  const parsedEmail = emailSchema.safeParse(readText(formData, "email"));
  if (!parsedEmail.success) {
    throw new Error("Informe um e-mail válido para o convite.");
  }

  const roleValue = readText(formData, "role");
  if (!STAFF_INVITATION_ROLES.includes(roleValue as StaffInvitationRole)) {
    throw new Error("O papel informado para o convite é inválido.");
  }

  const reason = readText(formData, "reason");
  if (reason.length < MIN_REASON_LENGTH) {
    throw new Error("Informe um motivo com pelo menos 3 caracteres.");
  }
  if (reason.length > MAX_REASON_LENGTH) {
    throw new Error("O motivo deve ter no máximo 500 caracteres.");
  }

  const rawGrants = readList(formData, "supportPermissionGrants");
  const rawViews = readList(formData, "supportPermissionViews");
  if (roleValue !== "support" && (rawGrants.length || rawViews.length)) {
    throw new Error(
      "Permissões adicionais só podem ser atribuídas ao papel Suporte."
    );
  }
  const grants =
    roleValue === "support" ? parseSupportPermissionGrants(rawGrants) : [];
  const views =
    roleValue === "support" ? parseSupportPermissionViews(rawViews) : [];
  if (grants.some((grant) => !grantRequiresView(grant, views))) {
    throw new Error(
      "Cada alteração precisa da visualização correspondente selecionada."
    );
  }

  return {
    email: parsedEmail.data,
    grants,
    reason,
    role: roleValue as StaffInvitationRole,
    views,
  };
};

export const parseStaffInvitationId = (formData: FormData): string => {
  const invitationId = readText(formData, "invitationId");
  if (!UUID_PATTERN.test(invitationId)) {
    throw new Error("O convite selecionado é inválido.");
  }
  return invitationId;
};
