import {
  DELEGABLE_SUPPORT_PERMISSIONS,
  DELEGABLE_SUPPORT_VIEWS,
  parseSupportPermissionGrants,
  parseSupportPermissionViews,
  SUPPORT_PERMISSION_VIEW_REQUIREMENTS,
  type SupportPermission,
  type SupportViewPermission,
} from "@/lib/support-permissions";

export const STAFF_ROLES = ["admin", "support", "student"] as const;
export const STAFF_SUPPORT_PERMISSIONS = DELEGABLE_SUPPORT_PERMISSIONS;
export const STAFF_SUPPORT_VIEWS = DELEGABLE_SUPPORT_VIEWS;

export type StaffRole = (typeof STAFF_ROLES)[number];

export interface StaffAccessCommand {
  grants: SupportPermission[];
  reason: string;
  role: StaffRole;
  targetUserId: string;
  views: SupportViewPermission[];
}

const MAX_REASON_LENGTH = 500;
const MAX_USER_ID_LENGTH = 200;
const MIN_REASON_LENGTH = 3;

const readText = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const isStaffRole = (value: string): value is StaffRole =>
  STAFF_ROLES.includes(value as StaffRole);

const grantRequiresView = (
  grant: SupportPermission,
  views: readonly SupportViewPermission[]
): boolean =>
  (SUPPORT_PERMISSION_VIEW_REQUIREMENTS[grant] ?? []).every((view) =>
    views.includes(view)
  );

export const parseStaffAccessCommand = (
  formData: FormData
): StaffAccessCommand => {
  const targetUserId = readText(formData, "targetUserId");
  const roleValue = readText(formData, "role");
  const reason = readText(formData, "reason");
  const rawGrants = formData
    .getAll("supportPermissionGrants")
    .map((value) => (typeof value === "string" ? value : value.name));
  const rawViews = formData
    .getAll("supportPermissionViews")
    .map((value) => (typeof value === "string" ? value : value.name));

  if (!targetUserId || targetUserId.length > MAX_USER_ID_LENGTH) {
    throw new Error("Informe uma Conta válida.");
  }

  if (!isStaffRole(roleValue)) {
    throw new Error("O papel informado é inválido.");
  }

  if (reason.length < MIN_REASON_LENGTH) {
    throw new Error("Informe um motivo com pelo menos 3 caracteres.");
  }
  if (reason.length > MAX_REASON_LENGTH) {
    throw new Error("O motivo deve ter no máximo 500 caracteres.");
  }

  if (
    roleValue !== "support" &&
    (rawGrants.length > 0 || rawViews.length > 0)
  ) {
    throw new Error(
      "Permissões administrativas só podem ser usadas com o papel suporte."
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
    grants,
    reason,
    role: roleValue,
    targetUserId,
    views,
  };
};
