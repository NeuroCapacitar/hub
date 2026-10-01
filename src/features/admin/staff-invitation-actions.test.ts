import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createOrRefreshStaffInvitation: vi.fn(),
  revalidatePath: vi.fn(),
  requirePermission: vi.fn(),
  resendStaffInvitation: vi.fn(),
  revokeStaffInvitation: vi.fn(),
  scheduleOutboxDrainAfterResponse: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: dependencies.revalidatePath,
}));
vi.mock("@/features/outbox/background-drain", () => ({
  scheduleOutboxDrainAfterResponse:
    dependencies.scheduleOutboxDrainAfterResponse,
}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));
vi.mock("./staff-invitations", () => ({
  createOrRefreshStaffInvitation: dependencies.createOrRefreshStaffInvitation,
  resendStaffInvitation: dependencies.resendStaffInvitation,
  revokeStaffInvitation: dependencies.revokeStaffInvitation,
}));

import {
  createStaffInvitationAction,
  resendStaffInvitationAction,
  revokeStaffInvitationAction,
} from "./staff-invitation-actions";

const INVITATION_ID = "8b5f2d8e-dc4d-43a3-9c1b-35dcac2a2a32";

const createInvitationForm = (): FormData => {
  const formData = new FormData();
  formData.set("email", "staff@example.test");
  formData.set("role", "admin");
  formData.set("reason", "Approved team access");
  return formData;
};

const createInvitationIdForm = (): FormData => {
  const formData = new FormData();
  formData.set("invitationId", INVITATION_ID);
  return formData;
};

beforeEach(() => {
  vi.resetAllMocks();
  dependencies.requirePermission.mockResolvedValue({
    user: { id: "admin-1" },
  });
  dependencies.createOrRefreshStaffInvitation.mockResolvedValue({
    invitationId: INVITATION_ID,
    outcome: "created",
  });
  dependencies.resendStaffInvitation.mockResolvedValue(undefined);
  dependencies.revokeStaffInvitation.mockResolvedValue(undefined);
});

describe("staff invitation actions", () => {
  it("schedules the outbox drain after creating or updating an invitation", async () => {
    const sequence: string[] = [];
    dependencies.createOrRefreshStaffInvitation.mockImplementation(() => {
      sequence.push("transaction-committed");
      return { invitationId: INVITATION_ID, outcome: "updated" };
    });
    dependencies.scheduleOutboxDrainAfterResponse.mockImplementation(() => {
      sequence.push("drain-scheduled");
    });

    await createStaffInvitationAction(createInvitationForm());

    expect(sequence).toEqual(["transaction-committed", "drain-scheduled"]);
    expect(dependencies.scheduleOutboxDrainAfterResponse).toHaveBeenCalledWith({
      aggregateId: INVITATION_ID,
    });
  });

  it("schedules the outbox drain after resending an invitation", async () => {
    const sequence: string[] = [];
    dependencies.resendStaffInvitation.mockImplementation(() => {
      sequence.push("transaction-committed");
    });
    dependencies.scheduleOutboxDrainAfterResponse.mockImplementation(() => {
      sequence.push("drain-scheduled");
    });

    await resendStaffInvitationAction(createInvitationIdForm());

    expect(sequence).toEqual(["transaction-committed", "drain-scheduled"]);
    expect(dependencies.scheduleOutboxDrainAfterResponse).toHaveBeenCalledWith({
      aggregateId: INVITATION_ID,
    });
  });

  it("does not schedule email delivery when revoking an invitation", async () => {
    await revokeStaffInvitationAction(createInvitationIdForm());

    expect(dependencies.revokeStaffInvitation).toHaveBeenCalledOnce();
    expect(
      dependencies.scheduleOutboxDrainAfterResponse
    ).not.toHaveBeenCalled();
  });

  it("does not schedule delivery when creating an invitation fails", async () => {
    dependencies.createOrRefreshStaffInvitation.mockRejectedValue(
      new Error("transaction failed")
    );

    await expect(
      createStaffInvitationAction(createInvitationForm())
    ).rejects.toThrow("transaction failed");

    expect(
      dependencies.scheduleOutboxDrainAfterResponse
    ).not.toHaveBeenCalled();
  });
});
