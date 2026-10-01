import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
  logOperationalEvent: vi.fn(),
  requestPublicAccountRegistration: vi.fn(),
  scheduleOutboxDrainAfterResponse: vi.fn(),
}));

vi.mock("@/features/account/email-challenges", () => ({
  requestPublicAccountRegistration:
    dependencies.requestPublicAccountRegistration,
}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("@/features/outbox/background-drain", () => ({
  scheduleOutboxDrainAfterResponse:
    dependencies.scheduleOutboxDrainAfterResponse,
}));
vi.mock("@/lib/observability", () => ({
  CORRELATION_ID_HEADER: "x-correlation-id",
  createCorrelationId: vi.fn(() => "test-correlation-id"),
  logOperationalEvent: dependencies.logOperationalEvent,
}));

import { POST } from "./route";

const request = (body: unknown): Request =>
  new Request("https://hub.example.test/api/account/registrations", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

describe("POST /api/account/registrations", () => {
  beforeEach(() => {
    dependencies.getServerEnv.mockReturnValue({
      AUTH_PUBLIC_SIGNUP_ENABLED: true,
    });
    dependencies.requestPublicAccountRegistration.mockReset();
    dependencies.scheduleOutboxDrainAfterResponse.mockReset();
    dependencies.logOperationalEvent.mockReset();
  });

  it.each([
    "queued",
    "suppressed",
    "rate_limited",
  ] as const)("returns the same neutral response for %s", async (outcome) => {
    dependencies.requestPublicAccountRegistration.mockResolvedValue(outcome);
    const response = await POST(
      request({
        email: "student@example.test",
        name: "Student Example",
        returnTo: "/comprar/curso-teste",
      })
    );

    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "accepted" });
    if (outcome === "queued") {
      expect(
        dependencies.scheduleOutboxDrainAfterResponse
      ).toHaveBeenCalledOnce();
    } else {
      expect(
        dependencies.scheduleOutboxDrainAfterResponse
      ).not.toHaveBeenCalled();
    }
  });

  it("does not call Better Auth or the service with a password payload", async () => {
    const response = await POST(
      request({
        email: "student@example.test",
        name: "Student Example",
        password: "attacker-chosen-password",
      })
    );

    expect(response.status).toBe(400);
    expect(
      dependencies.requestPublicAccountRegistration
    ).not.toHaveBeenCalled();
  });

  it("keeps public registration closed when the feature flag is off", async () => {
    dependencies.getServerEnv.mockReturnValue({
      AUTH_PUBLIC_SIGNUP_ENABLED: false,
    });

    const response = await POST(
      request({ email: "student@example.test", name: "Student Example" })
    );

    expect(response.status).toBe(404);
    expect(
      dependencies.requestPublicAccountRegistration
    ).not.toHaveBeenCalled();
  });
});
