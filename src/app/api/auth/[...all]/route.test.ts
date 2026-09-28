import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getAuth: vi.fn(),
  getServerEnv: vi.fn(),
  logOperationalEvent: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuth: dependencies.getAuth }));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("@/lib/observability", () => ({
  CORRELATION_ID_HEADER: "x-correlation-id",
  createCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  logOperationalEvent: dependencies.logOperationalEvent,
}));

import { GET, POST } from "./route";

describe("POST /api/auth/[...all]", () => {
  beforeEach(() => {
    dependencies.getServerEnv.mockReturnValue({
      AUTH_PUBLIC_SIGNUP_ENABLED: false,
    });
    dependencies.getAuth.mockReturnValue({
      handler: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    });
  });

  it("records a failed sign-in without account data", async () => {
    dependencies.getAuth.mockReturnValue({
      handler: vi.fn().mockResolvedValue(new Response(null, { status: 429 })),
    });

    await POST(new Request("https://hub.example.test/api/auth/sign-in/email"), {
      params: Promise.resolve({ all: ["sign-in", "email"] }),
    });

    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: "test-correlation-id",
        errorCode: "auth_rate_limited",
        httpStatus: 429,
        operation: "auth.sign_in",
        outcome: "failure",
      })
    );
  });

  it("records successful sign-in separately", async () => {
    await POST(new Request("https://hub.example.test/api/auth/sign-in/email"), {
      params: Promise.resolve({ all: ["sign-in", "email"] }),
    });

    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "auth.sign_in",
        outcome: "success",
      })
    );
  });

  it("blocks explicit social account creation when public signup is disabled", async () => {
    const handler = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    dependencies.getAuth.mockReturnValue({ handler });

    const response = await POST(
      new Request("https://hub.example.test/api/auth/sign-in/social", {
        body: JSON.stringify({ provider: "google", requestSignUp: true }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ all: ["sign-in", "social"] }) }
    );

    expect(response.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not block an ordinary social login when public signup is disabled", async () => {
    const handler = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    dependencies.getAuth.mockReturnValue({ handler });

    const response = await POST(
      new Request("https://hub.example.test/api/auth/sign-in/social", {
        body: JSON.stringify({ provider: "google" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ all: ["sign-in", "social"] }) }
    );

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it.each([
    200, 429, 500,
  ])("uses the same public response for verification-email result %s", async (status) => {
    dependencies.getAuth.mockReturnValue({
      handler: vi.fn().mockResolvedValue(
        Response.json(
          {
            email: "private@example.test",
            error: "provider-specific-detail",
            status: false,
            url: "https://hub.example.test/verify?token=secret-token",
          },
          { status }
        )
      ),
    });

    const response = await POST(
      new Request("https://hub.example.test/api/auth/send-verification-email", {
        body: JSON.stringify({ email: "private@example.test" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ all: ["send-verification-email"] }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: true });
    expect(dependencies.logOperationalEvent.mock.calls.flat()).not.toContain(
      "private@example.test"
    );
    expect(dependencies.logOperationalEvent.mock.calls.flat()).not.toContain(
      "secret-token"
    );
  });

  it("keeps verification-email delivery errors generic if the handler throws", async () => {
    dependencies.getAuth.mockReturnValue({
      handler: vi.fn().mockRejectedValue(new Error("private provider detail")),
    });

    const response = await POST(
      new Request("https://hub.example.test/api/auth/send-verification-email", {
        body: JSON.stringify({ email: "private@example.test" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ all: ["send-verification-email"] }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: true });
    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "verification_email_request_failed",
        operation: "auth.email_verification_request",
        outcome: "failure",
      })
    );
    expect(
      JSON.stringify(dependencies.logOperationalEvent.mock.calls)
    ).not.toContain("private@example.test");
    expect(
      JSON.stringify(dependencies.logOperationalEvent.mock.calls)
    ).not.toContain("private provider detail");
  });

  it("records a Google callback failure without logging OAuth query values", async () => {
    dependencies.getAuth.mockReturnValue({
      handler: vi
        .fn()
        .mockResolvedValue(
          Response.redirect(
            "https://hub.example.test/oauth/callback?error=account_not_linked&error_description=private-provider-detail",
            302
          )
        ),
    });

    await GET(
      new Request(
        "https://hub.example.test/api/auth/callback/google?code=private-code&state=private-state"
      )
    );

    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "google_oauth_callback_failed",
        operation: "auth.google_callback",
        outcome: "failure",
      })
    );
    const loggedEvents = JSON.stringify(
      dependencies.logOperationalEvent.mock.calls
    );
    expect(loggedEvents).not.toContain("private-provider-detail");
    expect(loggedEvents).not.toContain("private-code");
    expect(loggedEvents).not.toContain("private-state");
  });

  it("separates Google sign-in from explicit Google signup in operational events", async () => {
    await POST(
      new Request("https://hub.example.test/api/auth/sign-in/social", {
        body: JSON.stringify({
          email: "private@example.test",
          provider: "google",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ all: ["sign-in", "social"] }) }
    );

    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "auth.google_sign_in",
        outcome: "success",
      })
    );
    expect(
      JSON.stringify(dependencies.logOperationalEvent.mock.calls)
    ).not.toContain("private@example.test");
  });
});
