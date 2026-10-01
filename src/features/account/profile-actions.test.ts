import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  cancelEmailChangeRequest: vi.fn(),
  createOrRefreshEmailChangeRequest: vi.fn(),
  getPool: vi.fn(),
  headers: vi.fn(),
  revalidatePath: vi.fn(),
  requestExistingAccountEmailVerification: vi.fn(),
  requireAccountSession: vi.fn(),
  scheduleOutboxDrainAfterResponse: vi.fn(),
  removeUserAvatar: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: dependencies.revalidatePath,
}));
vi.mock("next/headers", () => ({
  headers: dependencies.headers,
}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/lib/session", () => ({
  requireAccountSession: dependencies.requireAccountSession,
}));
vi.mock("@/features/account/email-challenges", () => ({
  requestExistingAccountEmailVerification:
    dependencies.requestExistingAccountEmailVerification,
}));
vi.mock("@/features/account/avatar-storage", () => ({
  removeUserAvatar: dependencies.removeUserAvatar,
}));
vi.mock("@/features/account/email-change", () => ({
  cancelEmailChangeRequest: dependencies.cancelEmailChangeRequest,
  createOrRefreshEmailChangeRequest:
    dependencies.createOrRefreshEmailChangeRequest,
}));
vi.mock("@/features/outbox/background-drain", () => ({
  scheduleOutboxDrainAfterResponse:
    dependencies.scheduleOutboxDrainAfterResponse,
}));

import {
  removeAccountAvatarAction,
  requestAccountEmailChangeAction,
  requestAccountEmailVerificationAction,
  updateAccountNameAction,
} from "./profile-actions";

const accountSession = {
  emailVerified: true,
  platformBlockedAt: null,
  platformBlockedReason: null,
  role: "student" as const,
  supportPermissionGrants: [],
  supportPermissionViews: [],
  user: {
    email: "current@example.test",
    id: "session-owner",
    image: null,
    name: "Pessoa",
  },
};

const form = (fields: Record<string, string>): FormData => {
  const result = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    result.set(key, value);
  }
  return result;
};

describe("account profile actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.requireAccountSession.mockResolvedValue(accountSession);
    dependencies.headers.mockResolvedValue(new Headers());
    dependencies.requestExistingAccountEmailVerification.mockResolvedValue(
      "queued"
    );
    dependencies.createOrRefreshEmailChangeRequest.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      status: "pending_current",
    });
  });

  it("updates the session owner's name and ignores a submitted user id", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });
    dependencies.getPool.mockReturnValue({ query });

    await updateAccountNameAction(
      form({ name: "Nome atualizado", userId: "other-user" })
    );

    expect(query).toHaveBeenCalledWith(
      "update users set name = $2, updated_at = now() where id = $1",
      ["session-owner", "Nome atualizado"]
    );
  });

  it("requires confirmation before sending a verification request from the account page", async () => {
    await requestAccountEmailVerificationAction();

    expect(
      dependencies.requestExistingAccountEmailVerification
    ).toHaveBeenCalledWith({
      requestHeaders: expect.any(Headers),
      userId: "session-owner",
    });
    expect(
      dependencies.scheduleOutboxDrainAfterResponse
    ).toHaveBeenCalledOnce();
  });

  it("allows an authenticated account to request an email change without recent-session reauthentication", async () => {
    await requestAccountEmailChangeAction(
      form({ newEmail: "New@Example.test", userId: "other-user" })
    );

    expect(dependencies.requireAccountSession).toHaveBeenCalledOnce();
    expect(dependencies.createOrRefreshEmailChangeRequest).toHaveBeenCalledWith(
      {
        newEmail: "new@example.test",
        userId: "session-owner",
      }
    );
    expect(
      dependencies.scheduleOutboxDrainAfterResponse
    ).toHaveBeenCalledOnce();
  });

  it("removes only the signed-in account's custom avatar", async () => {
    await removeAccountAvatarAction();

    expect(dependencies.removeUserAvatar).toHaveBeenCalledWith({
      userId: "session-owner",
    });
  });
});
