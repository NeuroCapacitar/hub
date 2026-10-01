import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getAuth: vi.fn(),
  getServerEnv: vi.fn(),
  isStudentPlatformAccessBlocked: vi.fn(),
  logOperationalEvent: vi.fn(),
  requestAccountEmailVerificationByAddress: vi.fn(),
  withAccountPasswordResetOperation: vi.fn(),
}));

vi.mock("@/features/account/email-challenges", () => ({
  requestAccountEmailVerificationByAddress:
    dependencies.requestAccountEmailVerificationByAddress,
}));
vi.mock("@/lib/auth", () => ({
  getAuth: dependencies.getAuth,
  isStudentPlatformAccessBlocked: dependencies.isStudentPlatformAccessBlocked,
}));
vi.mock("@/features/account/password-reset-operations", () => ({
  withAccountPasswordResetOperation:
    dependencies.withAccountPasswordResetOperation,
}));
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
      api: { getSession: vi.fn().mockResolvedValue(null) },
    });
    dependencies.isStudentPlatformAccessBlocked.mockReset();
    dependencies.isStudentPlatformAccessBlocked.mockResolvedValue(false);
    dependencies.requestAccountEmailVerificationByAddress.mockReset();
    dependencies.withAccountPasswordResetOperation.mockImplementation(
      ({ handler }: { handler: () => Promise<Response> }) => handler()
    );
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

  it("blocks native Better Auth mutations for a suspended Student session", async () => {
    const handler = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const getSession = vi
      .fn()
      .mockResolvedValue({ user: { id: "blocked-student" } });
    dependencies.getAuth.mockReturnValue({ handler, api: { getSession } });
    dependencies.isStudentPlatformAccessBlocked.mockResolvedValue(true);

    const response = await POST(
      new Request("https://hub.example.test/api/auth/update-user", {
        headers: { cookie: "better-auth.session_token=session-token" },
        method: "POST",
        body: JSON.stringify({ name: "Changed directly" }),
      }),
      { params: Promise.resolve({ all: ["update-user"] }) }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "ACCOUNT_SUSPENDED",
    });
    expect(getSession).toHaveBeenCalledOnce();
    expect(dependencies.isStudentPlatformAccessBlocked).toHaveBeenCalledWith(
      "blocked-student"
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it.each([
    ["request-password-reset", "request-password-reset"],
    ["reset-password", "reset-password"],
  ] as const)("guards %s with the shared account identity lock", async (path, endpoint) => {
    const handler = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    dependencies.getAuth.mockReturnValue({ handler });
    const request = new Request(`https://hub.example.test/api/auth/${path}`, {
      body: JSON.stringify({ email: "student@example.test", token: "token" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const response = await POST(request, {
      params: Promise.resolve({ all: [path] }),
    });

    expect(response.status).toBe(200);
    expect(dependencies.withAccountPasswordResetOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint,
        request,
        handler: expect.any(Function),
      })
    );
    expect(handler).toHaveBeenCalledOnce();
  });

  it("fails closed when the password-reset guard cannot reach the database", async () => {
    const handler = vi.fn();
    dependencies.getAuth.mockReturnValue({ handler });
    dependencies.withAccountPasswordResetOperation.mockRejectedValueOnce(
      new Error("database unavailable")
    );

    const response = await POST(
      new Request("https://hub.example.test/api/auth/reset-password", {
        body: JSON.stringify({ token: "token" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ all: ["reset-password"] }) }
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "password_reset_temporarily_unavailable",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("keeps sign-out available for a suspended Student", async () => {
    const handler = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    dependencies.getAuth.mockReturnValue({
      api: {
        getSession: vi
          .fn()
          .mockResolvedValue({ user: { id: "blocked-student" } }),
      },
      handler,
    });
    dependencies.isStudentPlatformAccessBlocked.mockResolvedValue(true);

    const response = await POST(
      new Request("https://hub.example.test/api/auth/sign-out", {
        method: "POST",
      }),
      { params: Promise.resolve({ all: ["sign-out"] }) }
    );

    expect(response.status).toBe(200);
    expect(dependencies.isStudentPlatformAccessBlocked).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledOnce();
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

  it("blocks Better Auth email signup even while the explicit signup page is enabled", async () => {
    const handler = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    dependencies.getServerEnv.mockReturnValue({
      AUTH_PUBLIC_SIGNUP_ENABLED: true,
    });
    dependencies.getAuth.mockReturnValue({ handler });

    const response = await POST(
      new Request("https://hub.example.test/api/auth/sign-up/email", {
        body: JSON.stringify({
          email: "victim@example.test",
          name: "Attacker",
          password: "attacker-chosen-password",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ all: ["sign-up", "email"] }) }
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
    "queued",
    "suppressed",
    "rate_limited",
  ] as const)("uses the same public response for verification-email result %s", async (outcome) => {
    const handler = vi.fn();
    dependencies.getAuth.mockReturnValue({ handler });
    dependencies.requestAccountEmailVerificationByAddress.mockResolvedValue(
      outcome
    );

    const request = new Request(
      "https://hub.example.test/api/auth/send-verification-email",
      {
        body: JSON.stringify({ email: "private@example.test" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ all: ["send-verification-email"] }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: true });
    expect(handler).not.toHaveBeenCalled();
    expect(
      dependencies.requestAccountEmailVerificationByAddress
    ).toHaveBeenCalledWith({
      email: "private@example.test",
      requestHeaders: request.headers,
    });
    expect(
      JSON.stringify(dependencies.logOperationalEvent.mock.calls)
    ).not.toContain("private@example.test");
  });

  it("keeps verification-email delivery errors generic if the handler throws", async () => {
    dependencies.requestAccountEmailVerificationByAddress.mockRejectedValueOnce(
      new Error("private provider detail")
    );

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
        provider: "database",
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

describe("GET /api/auth/[...all]", () => {
  it("does not let a legacy verification GET mutate account state", async () => {
    const handler = vi.fn();
    dependencies.getAuth.mockReturnValue({ handler });

    const response = await GET(
      new Request(
        "https://hub.example.test/api/auth/verify-email?token=private-token&callbackURL=https%3A%2F%2Fevil.example"
      )
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://hub.example.test/confirmar-email?legacy=1"
    );
    expect(handler).not.toHaveBeenCalled();
  });
});
