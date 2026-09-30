import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  acceptStaffInvitation: vi.fn(),
  createCorrelationId: vi.fn(() => "correlation-id"),
  logOperationalEvent: vi.fn(),
  previewStaffInvitation: vi.fn(),
}));

vi.mock("@/features/admin/staff-invitations", () => ({
  acceptStaffInvitation: dependencies.acceptStaffInvitation,
  previewStaffInvitation: dependencies.previewStaffInvitation,
}));
vi.mock("@/lib/observability", () => ({
  CORRELATION_ID_HEADER: "x-correlation-id",
  createCorrelationId: dependencies.createCorrelationId,
  logOperationalEvent: dependencies.logOperationalEvent,
}));

import { POST as accept } from "./accept/route";
import { POST as preview } from "./preview/route";

describe("staff invitation endpoints", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.createCorrelationId.mockReturnValue("correlation-id");
  });

  it("previews a valid invitation without returning or consuming its token", async () => {
    dependencies.previewStaffInvitation.mockResolvedValue({
      alreadyAccepted: false,
      email: "staff@example.test",
      existingStudent: true,
      expiresAt: new Date("2026-10-06T12:00:00.000Z"),
      inviterName: "Admin",
      requiresName: false,
      role: "support",
      willRemovePassword: true,
    });
    const response = await preview(
      new Request(
        "https://hub.example.test/api/account/staff-invitations/preview",
        {
          body: JSON.stringify({ token: "signed-token" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      invitation: {
        alreadyAccepted: false,
        email: "staff@example.test",
        existingStudent: true,
        expiresAt: "2026-10-06T12:00:00.000Z",
        inviterName: "Admin",
        requiresName: false,
        role: "support",
        willRemovePassword: true,
      },
      status: "ready",
    });
    expect(dependencies.previewStaffInvitation).toHaveBeenCalledWith(
      "signed-token"
    );
  });

  it("rejects malformed requests and does not consume an invitation during preview", async () => {
    const response = await preview(
      new Request(
        "https://hub.example.test/api/account/staff-invitations/preview",
        {
          body: JSON.stringify({ token: "x", extra: true }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }
      )
    );

    expect(response.status).toBe(400);
    expect(dependencies.previewStaffInvitation).not.toHaveBeenCalled();
  });

  it("accepts a valid invitation without creating a session response", async () => {
    dependencies.acceptStaffInvitation.mockResolvedValue({
      nextPath: "/entrar?returnTo=%2Fadmin",
    });
    const response = await accept(
      new Request(
        "https://hub.example.test/api/account/staff-invitations/accept",
        {
          body: JSON.stringify({ name: "New Staff", token: "signed-token" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      nextPath: "/entrar?returnTo=%2Fadmin",
      status: "accepted",
    });
    expect(dependencies.acceptStaffInvitation).toHaveBeenCalledWith({
      name: "New Staff",
      token: "signed-token",
    });
  });

  it("rejects oversized names and token strings", async () => {
    const response = await accept(
      new Request(
        "https://hub.example.test/api/account/staff-invitations/accept",
        {
          body: JSON.stringify({
            name: "x".repeat(121),
            token: "signed-token",
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }
      )
    );

    expect(response.status).toBe(400);
    expect(dependencies.acceptStaffInvitation).not.toHaveBeenCalled();
  });
});
