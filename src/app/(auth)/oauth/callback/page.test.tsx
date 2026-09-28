import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  connection: vi.fn(),
  getCurrentSession: vi.fn(),
  getServerEnv: vi.fn(),
  recordLastAccess: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: dependencies.redirect }));
vi.mock("next/server", () => ({ connection: dependencies.connection }));
vi.mock("@/lib/session", () => ({
  getCurrentSession: dependencies.getCurrentSession,
  recordLastAccess: dependencies.recordLastAccess,
}));
vi.mock("@/components/auth-shell", () => ({
  AuthShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("./oauth-callback-client", () => ({
  GoogleOAuthCallbackClient: ({
    hasProviderError,
    returnTo,
    verificationCallbackUrl,
  }: {
    hasProviderError: boolean;
    returnTo: string | null;
    verificationCallbackUrl: string;
  }) => (
    <div
      data-has-provider-error={String(hasProviderError)}
      data-return-to={returnTo ?? "none"}
      data-verification-callback-url={verificationCallbackUrl}
    />
  ),
}));

import GoogleOAuthCallbackPage from "./page";

describe("GoogleOAuthCallbackPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.connection.mockResolvedValue(undefined);
    dependencies.getCurrentSession.mockResolvedValue(null);
    dependencies.getServerEnv.mockReturnValue({
      BETTER_AUTH_URL: "https://hub.example.test",
      SUPPORT_EMAIL: "support@example.test",
    });
    dependencies.recordLastAccess.mockResolvedValue(undefined);
    dependencies.redirect.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
  });

  it("returns a cancelled login to sign-in without exposing OAuth details", async () => {
    await expect(
      GoogleOAuthCallbackPage({
        searchParams: Promise.resolve({
          error: "access_denied",
          error_description: "private-provider-detail",
          returnTo: "/comprar/curso-gratis",
        }),
      })
    ).rejects.toThrow("redirect:/entrar?returnTo=%2Fcomprar%2Fcurso-gratis");
    expect(dependencies.redirect).toHaveBeenCalledOnce();
    expect(dependencies.getCurrentSession).not.toHaveBeenCalled();
  });

  it("redirects an authenticated student to the app on the server", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role: "student",
      user: { id: "student-1" },
    });

    await expect(
      GoogleOAuthCallbackPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("redirect:/app");

    expect(dependencies.recordLastAccess).toHaveBeenCalledWith("student-1");
    expect(dependencies.getServerEnv).not.toHaveBeenCalled();
  });

  it("preserves a safe purchase return for an authenticated student", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role: "student",
      user: { id: "student-1" },
    });

    await expect(
      GoogleOAuthCallbackPage({
        searchParams: Promise.resolve({ returnTo: "/comprar/curso-gratis" }),
      })
    ).rejects.toThrow("redirect:/comprar/curso-gratis");
  });

  it.each([
    "admin",
    "support",
  ] as const)("redirects an authenticated %s to the admin surface on the server", async (role) => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role,
      supportPermissionGrants: [],
      supportPermissionViews: [],
      user: { id: `${role}-1` },
    });

    await expect(
      GoogleOAuthCallbackPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("redirect:/admin");
  });

  it("keeps a blocked student on the existing recovery flow", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: new Date("2026-09-01T12:00:00.000Z"),
      role: "student",
      user: { id: "blocked-student-1" },
    });

    const markup = renderToStaticMarkup(
      await GoogleOAuthCallbackPage({ searchParams: Promise.resolve({}) })
    );

    expect(markup).toContain('data-has-provider-error="false"');
    expect(dependencies.redirect).not.toHaveBeenCalled();
    expect(dependencies.recordLastAccess).not.toHaveBeenCalled();
  });

  it("reduces provider failures to a boolean and builds same-origin verification return", async () => {
    const markup = renderToStaticMarkup(
      await GoogleOAuthCallbackPage({
        searchParams: Promise.resolve({
          error: "account_not_linked",
          error_description: "private-provider-detail",
          returnTo: "/comprar/curso-gratis",
        }),
      })
    );

    expect(markup).toContain('data-has-provider-error="true"');
    expect(markup).toContain('data-return-to="/comprar/curso-gratis"');
    expect(markup).toContain(
      'data-verification-callback-url="https://hub.example.test/entrar?emailVerified=1&amp;returnTo=%2Fcomprar%2Fcurso-gratis"'
    );
    expect(markup).not.toContain("private-provider-detail");
    expect(markup).not.toContain("account_not_linked");
    expect(dependencies.getCurrentSession).not.toHaveBeenCalled();
  });

  it("drops a malformed return path from the verification callback", async () => {
    const markup = renderToStaticMarkup(
      await GoogleOAuthCallbackPage({
        searchParams: Promise.resolve({
          error: "provider_error",
          returnTo: "https://outside.example/",
        }),
      })
    );

    expect(markup).toContain('data-return-to="none"');
    expect(markup).toContain(
      'data-verification-callback-url="https://hub.example.test/entrar?emailVerified=1"'
    );
  });
});
