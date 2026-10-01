import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  consumeEmailChangeToken: vi.fn(),
  createCorrelationId: vi.fn(() => "correlation-id"),
  logOperationalEvent: vi.fn(),
  previewEmailChange: vi.fn(),
}));

vi.mock("@/features/account/email-change", () => ({
  consumeEmailChangeToken: dependencies.consumeEmailChangeToken,
  previewEmailChange: dependencies.previewEmailChange,
}));
vi.mock("@/lib/observability", () => ({
  CORRELATION_ID_HEADER: "x-correlation-id",
  createCorrelationId: dependencies.createCorrelationId,
  logOperationalEvent: dependencies.logOperationalEvent,
}));

import { POST as consume } from "./consume/route";
import { POST as preview } from "./preview/route";

describe("account email change routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.createCorrelationId.mockReturnValue("correlation-id");
  });

  it("previews the two-step proof without changing the email", async () => {
    dependencies.previewEmailChange.mockResolvedValue({
      currentEmail: "old@example.test",
      expiresAt: new Date("2026-09-29T16:00:00.000Z"),
      newEmail: "new@example.test",
      stage: "pending_new",
      userName: "Pessoa",
    });
    const response = await preview(
      new Request(
        "https://hub.example.test/api/account/email-changes/preview",
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
      change: {
        currentEmail: "old@example.test",
        expiresAt: "2026-09-29T16:00:00.000Z",
        newEmail: "new@example.test",
        stage: "pending_new",
        userName: "Pessoa",
      },
      status: "ready",
    });
    expect(dependencies.previewEmailChange).toHaveBeenCalledWith(
      "signed-token"
    );
  });

  it("rejects extra preview fields before checking the token", async () => {
    const response = await preview(
      new Request(
        "https://hub.example.test/api/account/email-changes/preview",
        {
          body: JSON.stringify({ token: "signed-token", userId: "other-user" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }
      )
    );
    expect(response.status).toBe(400);
    expect(dependencies.previewEmailChange).not.toHaveBeenCalled();
  });

  it("returns only a same-origin next path after an explicit confirmation POST", async () => {
    dependencies.consumeEmailChangeToken.mockResolvedValue({
      nextPath: "/entrar?emailChanged=1",
    });
    const response = await consume(
      new Request(
        "https://hub.example.test/api/account/email-changes/consume",
        {
          body: JSON.stringify({ token: "signed-token" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      nextPath: "/entrar?emailChanged=1",
      status: "confirmed",
    });
  });
});
