import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  connection: vi.fn(),
  getServerEnv: vi.fn(),
  getCurrentSession: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: dependencies.redirect }));
vi.mock("next/server", () => ({ connection: dependencies.connection }));
vi.mock("@/components/auth-shell", () => ({
  AuthShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/session", () => ({
  getCurrentSession: dependencies.getCurrentSession,
}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("./sign-in-form", () => ({
  SignInForm: ({
    googleLoginEnabled,
    googleOAuthCallbackUrl,
    emailVerified,
    emailVerificationFailed,
    returnTo,
    supportEmail,
  }: {
    googleLoginEnabled: boolean;
    googleOAuthCallbackUrl: string;
    emailVerified: boolean;
    emailVerificationFailed: boolean;
    returnTo: string | null;
    supportEmail: string | null;
  }) => (
    <div
      data-email-verification-failed={String(emailVerificationFailed)}
      data-email-verified={String(emailVerified)}
      data-google-callback-url={googleOAuthCallbackUrl}
      data-google-login-enabled={String(googleLoginEnabled)}
      data-return-to={returnTo ?? "none"}
      data-support-email={supportEmail ?? "none"}
    >
      Sign-in form
    </div>
  ),
}));

import SignInPage from "./page";

const COURSE_RETURN_TO = "/comprar/curso-gratis";

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.connection.mockResolvedValue(undefined);
    dependencies.getServerEnv.mockReturnValue({
      BETTER_AUTH_URL: "https://hub.example.test",
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
      SUPPORT_EMAIL: "support@example.test",
    });
    dependencies.getCurrentSession.mockResolvedValue(null);
    dependencies.redirect.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
  });

  it("passes only a safe purchase return path to the anonymous form", async () => {
    const markup = renderToStaticMarkup(
      await SignInPage({
        searchParams: Promise.resolve({ returnTo: COURSE_RETURN_TO }),
      })
    );

    expect(markup).toContain('data-return-to="/comprar/curso-gratis"');
    expect(markup).toContain('data-support-email="support@example.test"');
    expect(markup).toContain(
      "Entre para voltar ao Curso e confirmar sua inscrição gratuita."
    );
    expect(dependencies.redirect).not.toHaveBeenCalled();
  });

  it("passes only provider availability, never the Google client secret, to the form", async () => {
    dependencies.getServerEnv.mockReturnValue({
      BETTER_AUTH_URL: "https://hub.example.test",
      GOOGLE_CLIENT_ID: "google-client-id-fixture",
      GOOGLE_CLIENT_SECRET: "google-client-secret-fixture",
      SUPPORT_EMAIL: "support@example.test",
    });

    const markup = renderToStaticMarkup(
      await SignInPage({ searchParams: Promise.resolve({}) })
    );

    expect(markup).toContain('data-google-login-enabled="true"');
    expect(markup).toContain(
      'data-google-callback-url="https://hub.example.test/oauth/callback"'
    );
    expect(markup).not.toContain("google-client-secret-fixture");
  });

  it("recognizes the one-time email verification return without exposing a token", async () => {
    const markup = renderToStaticMarkup(
      await SignInPage({
        searchParams: Promise.resolve({ emailVerified: "1" }),
      })
    );

    expect(markup).toContain('data-email-verified="true"');
  });

  it("does not report a failed Better Auth email-verification redirect as success", async () => {
    const markup = renderToStaticMarkup(
      await SignInPage({
        searchParams: Promise.resolve({
          emailVerified: "1",
          error: "TOKEN_EXPIRED",
        }),
      })
    );

    expect(markup).toContain('data-email-verified="false"');
    expect(markup).toContain('data-email-verification-failed="true"');
    expect(markup).not.toContain("TOKEN_EXPIRED");
  });

  it("redirects an authenticated Student to a valid return path", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role: "student",
    });

    await expect(
      SignInPage({
        searchParams: Promise.resolve({ returnTo: COURSE_RETURN_TO }),
      })
    ).rejects.toThrow(`redirect:${COURSE_RETURN_TO}`);
  });

  it.each([
    "admin",
    "support",
  ] as const)("keeps %s on the admin surface even with a Student return path", async (role) => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role,
    });

    await expect(
      SignInPage({
        searchParams: Promise.resolve({ returnTo: COURSE_RETURN_TO }),
      })
    ).rejects.toThrow("redirect:/admin");
  });

  it("shows only support and sign-out actions for a blocked Student", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: new Date("2026-09-01T12:00:00.000Z"),
      role: "student",
    });

    const markup = renderToStaticMarkup(
      await SignInPage({
        searchParams: Promise.resolve({ returnTo: COURSE_RETURN_TO }),
      })
    );

    expect(markup).not.toContain("/app/configuracoes");
    expect(markup).toContain("Acesso à plataforma suspenso");
    expect(markup).toContain("Falar com o suporte");
    expect(markup).toContain("mailto:support@example.test");
    expect(markup).toContain("Sair da conta");
    expect(dependencies.redirect).not.toHaveBeenCalled();
  });
});
