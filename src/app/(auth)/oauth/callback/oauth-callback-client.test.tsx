/**
 * @vitest-environment jsdom
 */

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  fetch: vi.fn(),
  replace: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { sendVerificationEmail: dependencies.sendVerificationEmail },
}));

import { GoogleOAuthCallbackClient } from "./oauth-callback-client";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

describe("GoogleOAuthCallbackClient", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hadActEnvironment = false;
  let previousActEnvironment: boolean | undefined;

  beforeEach(() => {
    hadActEnvironment = "IS_REACT_ACT_ENVIRONMENT" in globalThis;
    previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    dependencies.fetch.mockReset();
    dependencies.replace.mockReset();
    dependencies.sendVerificationEmail.mockReset();
    vi.stubGlobal("fetch", dependencies.fetch);
    const testWindow = Object.create(window) as Window;
    Object.defineProperty(testWindow, "location", {
      value: { replace: dependencies.replace },
    });
    vi.stubGlobal("window", testWindow);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    if (hadActEnvironment) {
      globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment as boolean;
    } else {
      Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    }
  });

  it("uses the existing role-aware redirect after a successful callback", async () => {
    dependencies.fetch.mockResolvedValueOnce(
      jsonResponse({ redirectTo: "/admin" })
    );

    await act(async () => {
      root.render(
        <GoogleOAuthCallbackClient
          hasProviderError={false}
          returnTo="/comprar/curso-gratis"
          supportEmail={null}
          verificationCallbackUrl="https://hub.example.test/entrar?emailVerified=1"
        />
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(dependencies.fetch).toHaveBeenCalledWith(
      "/api/auth/redirect?returnTo=%2Fcomprar%2Fcurso-gratis",
      expect.objectContaining({ credentials: "same-origin" })
    );
    expect(dependencies.replace).toHaveBeenCalledWith("/admin");
  });

  it("signs out a blocked Student session and explains the recovery path", async () => {
    dependencies.fetch
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await act(async () => {
      root.render(
        <GoogleOAuthCallbackClient
          hasProviderError={false}
          returnTo={null}
          supportEmail="support@example.test"
          verificationCallbackUrl="https://hub.example.test/entrar?emailVerified=1"
        />
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(dependencies.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/auth/sign-out",
      expect.objectContaining({ method: "POST" })
    );
    expect(container.textContent).toContain("Acesso bloqueado");
    expect(container.querySelector('a[href^="mailto:"]')).not.toBeNull();
  });

  it("reveals the verification form only after the user asks for it", async () => {
    dependencies.sendVerificationEmail.mockResolvedValue({
      data: { status: true },
    });

    act(() =>
      root.render(
        <GoogleOAuthCallbackClient
          hasProviderError
          returnTo="/comprar/curso-gratis"
          supportEmail={null}
          verificationCallbackUrl="https://hub.example.test/entrar?emailVerified=1&returnTo=%2Fcomprar%2Fcurso-gratis"
        />
      )
    );

    expect(container.querySelector('input[type="email"]')).toBeNull();

    const revealButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("Enviar link de confirmação")
    );
    await act(async () => revealButton?.click());

    const email = container.querySelector<HTMLInputElement>(
      'input[type="email"]'
    );
    expect(email).not.toBeNull();
    if (!email) {
      throw new Error("Expected the verification email field to appear.");
    }
    email.value = "student@example.test";
    const form = email.closest("form");
    if (!form) {
      throw new Error("Expected the verification form to be rendered.");
    }

    await act(async () => {
      form.requestSubmit();
      await Promise.resolve();
    });

    expect(dependencies.sendVerificationEmail).toHaveBeenCalledWith({
      callbackURL:
        "https://hub.example.test/entrar?emailVerified=1&returnTo=%2Fcomprar%2Fcurso-gratis",
      email: "student@example.test",
    });
    expect(container.textContent).toContain(
      "Se este e-mail corresponder a uma conta que precisa de confirmação, enviaremos um link."
    );
  });

  it("never renders provider error details", () => {
    act(() =>
      root.render(
        <GoogleOAuthCallbackClient
          hasProviderError
          returnTo={null}
          supportEmail={null}
          verificationCallbackUrl="https://hub.example.test/entrar?emailVerified=1"
        />
      )
    );

    expect(container.textContent).toContain(
      "Não foi possível concluir a entrada com Google."
    );
    expect(container.textContent).not.toContain("access_denied");
    expect(dependencies.fetch).not.toHaveBeenCalled();
  });
});
