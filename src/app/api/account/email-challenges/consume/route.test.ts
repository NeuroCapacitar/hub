import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  consumeAccountEmailChallenge: vi.fn(),
  logOperationalEvent: vi.fn(),
}));

vi.mock("@/features/account/email-challenges", () => ({
  consumeAccountEmailChallenge: dependencies.consumeAccountEmailChallenge,
}));
vi.mock("@/lib/observability", () => ({
  CORRELATION_ID_HEADER: "x-correlation-id",
  createCorrelationId: vi.fn(() => "test-correlation-id"),
  logOperationalEvent: dependencies.logOperationalEvent,
}));

import { POST } from "./route";

const makeRequest = (body: unknown): Request =>
  new Request("https://hub.example.test/api/account/email-challenges/consume", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

describe("POST /api/account/email-challenges/consume", () => {
  beforeEach(() => {
    dependencies.consumeAccountEmailChallenge.mockReset();
    dependencies.logOperationalEvent.mockReset();
  });

  it("consumes only an explicit token POST and returns a same-site login path", async () => {
    dependencies.consumeAccountEmailChallenge.mockResolvedValue({
      confirmed: true,
      nextPath: "/entrar?emailVerified=1",
    });

    const response = await POST(makeRequest({ token: "signed-challenge" }));

    expect(dependencies.consumeAccountEmailChallenge).toHaveBeenCalledWith(
      "signed-challenge"
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      nextPath: "/entrar?emailVerified=1",
      status: "confirmed",
    });
  });

  it("rejects extra fields rather than accepting client-supplied identity", async () => {
    const response = await POST(
      makeRequest({ token: "signed-challenge", userId: "victim-user" })
    );

    expect(response.status).toBe(400);
    expect(dependencies.consumeAccountEmailChallenge).not.toHaveBeenCalled();
  });
});
