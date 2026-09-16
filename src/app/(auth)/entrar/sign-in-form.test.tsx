/**
 * @vitest-environment jsdom
 */

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  assign: vi.fn(),
  fetch: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("sonner", () => ({
  toast: { error: dependencies.toastError },
}));

import { SignInForm } from "./sign-in-form";

const COURSE_RETURN_TO = "/comprar/curso-gratis";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

const getForm = (container: HTMLDivElement): HTMLFormElement => {
  const form = container.querySelector("form");
  if (!form) {
    throw new Error("Expected the sign-in form to be rendered.");
  }
  return form;
};

const fillCredentials = (container: HTMLDivElement): void => {
  const email = container.querySelector<HTMLInputElement>("#email");
  const password = container.querySelector<HTMLInputElement>("#password");
  if (!(email && password)) {
    throw new Error("Expected the sign-in fields to be rendered.");
  }
  email.value = "student@example.test";
  password.value = "password-123";
};

const stubLocationAssign = (): void => {
  const testWindow = Object.create(window) as Window;
  Object.defineProperty(testWindow, "location", {
    value: { assign: dependencies.assign },
  });
  vi.stubGlobal("window", testWindow);
};

describe("SignInForm", () => {
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
    dependencies.fetch.mockResolvedValueOnce(
      jsonResponse({ user: { id: "student-1" } })
    );
    dependencies.fetch.mockResolvedValueOnce(
      jsonResponse({ redirectTo: COURSE_RETURN_TO })
    );
    vi.stubGlobal("fetch", dependencies.fetch);
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

  it("encodes a validated course return path in the redirect request", async () => {
    act(() => root.render(<SignInForm returnTo={COURSE_RETURN_TO} />));
    fillCredentials(container);
    stubLocationAssign();

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(dependencies.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/auth/redirect?returnTo=%2Fcomprar%2Fcurso-gratis",
      expect.objectContaining({ credentials: "same-origin" })
    );
    expect(dependencies.assign).toHaveBeenCalledWith(COURSE_RETURN_TO);
  });

  it("drops an invalid return prop instead of sending it to the redirect route", async () => {
    act(() =>
      root.render(<SignInForm returnTo="https://other.example/escape" />)
    );
    fillCredentials(container);
    stubLocationAssign();

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(dependencies.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/auth/redirect",
      expect.objectContaining({ credentials: "same-origin" })
    );
    expect(dependencies.assign).toHaveBeenCalledWith(COURSE_RETURN_TO);
  });
});
