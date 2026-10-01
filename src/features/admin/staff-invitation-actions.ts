"use server";

import { revalidatePath } from "next/cache";
import { scheduleOutboxDrainAfterResponse } from "@/features/outbox/background-drain";
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
  const result = await createOrRefreshStaffInvitation({
    actorUserId: session.user.id,
    input,
  });
  scheduleOutboxDrainAfterResponse({ aggregateId: result.invitationId });
  refreshTeamPage();
};

export const resendStaffInvitationAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageStaffAccess");
  const invitationId = parseStaffInvitationId(formData);
  await resendStaffInvitation({
    actorUserId: session.user.id,
    invitationId,
  });
  scheduleOutboxDrainAfterResponse({ aggregateId: invitationId });
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
