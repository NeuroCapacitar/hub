"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth-permissions";
import {
  parseStaffInvitationId,
  parseStaffInvitationInput,
} from "./staff-invitation-input";
import {
  createOrRefreshStaffInvitation,
  resendStaffInvitation,
  revokeStaffInvitation,
} from "./staff-invitations";

const refreshTeamPage = (): void => {
  revalidatePath("/admin");
  revalidatePath("/admin/equipe");
};

export const createStaffInvitationAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageStaffAccess");
  const input = parseStaffInvitationInput(formData);
  await createOrRefreshStaffInvitation({
    actorUserId: session.user.id,
    input,
  });
  refreshTeamPage();
};

export const resendStaffInvitationAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageStaffAccess");
  await resendStaffInvitation({
    actorUserId: session.user.id,
    invitationId: parseStaffInvitationId(formData),
  });
  refreshTeamPage();
};

export const revokeStaffInvitationAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageStaffAccess");
  await revokeStaffInvitation({
    actorUserId: session.user.id,
    invitationId: parseStaffInvitationId(formData),
  });
  refreshTeamPage();
};
