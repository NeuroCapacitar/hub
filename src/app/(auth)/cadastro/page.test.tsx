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
vi.mock("./sign-up-form", () => ({
  SignUpForm: ({
    googleLoginEnabled,
    googleOAuthCallbackUrl,
    returnTo,
  }: {
    googleLoginEnabled: boolean;
    googleOAuthCallbackUrl: string;
    returnTo: string | null;
  }) => (
    <div
      data-google-callback-url={googleOAuthCallbackUrl}
      data-google-login-enabled={String(googleLoginEnabled)}
      data-return-to={returnTo ?? "none"}
    >
      Sign-up form
    </div>
  ),
}));

import SignUpPage from "./page";

const COURSE_RETURN_TO = "/comprar/curso-gratis";

describe("SignUpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.connection.mockResolvedValue(undefined);
    dependencies.getServerEnv.mockReturnValue({
      AUTH_PUBLIC_SIGNUP_ENABLED: true,
      BETTER_AUTH_URL: "http://localhost:3000",
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
    });
    dependencies.getCurrentSession.mockResolvedValue(null);
    dependencies.redirect.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
  });

  it("passes only a safe purchase return path to the anonymous form", async () => {
    const markup = renderToStaticMarkup(
      await SignUpPage({
        searchParams: Promise.resolve({ returnTo: COURSE_RETURN_TO }),
      })
    );

    expect(markup).toContain('data-return-to="/comprar/curso-gratis"');
    expect(markup).toContain(
      "Depois de criar sua conta, você voltará ao Curso para confirmar sua inscrição gratuita."
    );
    expect(dependencies.redirect).not.toHaveBeenCalled();
  });

  it("passes a public provider-availability boolean to the signup form", async () => {
    dependencies.getServerEnv.mockReturnValue({
      AUTH_PUBLIC_SIGNUP_ENABLED: true,
      BETTER_AUTH_URL: "http://localhost:3000",
      GOOGLE_CLIENT_ID: "google-client-id-fixture",
      GOOGLE_CLIENT_SECRET: "google-client-secret-fixture",
    });

    const markup = renderToStaticMarkup(
      await SignUpPage({ searchParams: Promise.resolve({}) })
    );

    expect(markup).toContain('data-google-login-enabled="true"');
    expect(markup).toContain(
      'data-google-callback-url="http://localhost:3000/oauth/callback"'
    );
    expect(markup).not.toContain("google-client-secret-fixture");
  });

  it("does not render signup fields when public signup is disabled", async () => {
    dependencies.getServerEnv.mockReturnValue({
      AUTH_PUBLIC_SIGNUP_ENABLED: false,
      BETTER_AUTH_URL: "http://localhost:3000",
      GOOGLE_CLIENT_ID: "google-client-id-fixture",
      GOOGLE_CLIENT_SECRET: "google-client-secret-fixture",
    });

    const markup = renderToStaticMarkup(
      await SignUpPage({
        searchParams: Promise.resolve({ returnTo: COURSE_RETURN_TO }),
      })
    );

    expect(markup).toContain("Cadastro indisponível");
    expect(markup).toContain(
      'href="/entrar?returnTo=%2Fcomprar%2Fcurso-gratis"'
    );
    expect(markup).not.toContain("Sign-up form");
    expect(markup).not.toContain("Criar conta com Google");
  });

  it("redirects an authenticated Student to a valid return path", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role: "student",
    });

    await expect(
      SignUpPage({
        searchParams: Promise.resolve({ returnTo: COURSE_RETURN_TO }),
      })
    ).rejects.toThrow(`redirect:${COURSE_RETURN_TO}`);
  });

  it("keeps an authenticated team account on the admin surface", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role: "support",
    });

    await expect(
      SignUpPage({
        searchParams: Promise.resolve({ returnTo: COURSE_RETURN_TO }),
      })
    ).rejects.toThrow("redirect:/admin");
  });

  it("does not redirect a blocked Student through returnTo", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: new Date("2026-09-01T12:00:00.000Z"),
      role: "student",
    });

    const markup = renderToStaticMarkup(
      await SignUpPage({
        searchParams: Promise.resolve({ returnTo: COURSE_RETURN_TO }),
      })
    );

    expect(markup).toContain('data-return-to="/comprar/curso-gratis"');
    expect(dependencies.redirect).not.toHaveBeenCalled();
  });
});
