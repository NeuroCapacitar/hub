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
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { SignUpForm } from "./sign-up-form";

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
    throw new Error("Expected the sign-up form to be rendered.");
  }
  return form;
};

const fillCredentials = (container: HTMLDivElement): void => {
  const name = container.querySelector<HTMLInputElement>("#name");
  const email = container.querySelector<HTMLInputElement>("#email");
  const password = container.querySelector<HTMLInputElement>("#password");
  const confirmation = container.querySelector<HTMLInputElement>(
    "#passwordConfirmation"
  );
  if (!(name && email && password && confirmation)) {
    throw new Error("Expected the sign-up fields to be rendered.");
  }
  name.value = "Student Example";
  email.value = "student@example.test";
  password.value = "Password-123!";
  confirmation.value = "Password-123!";
};

const stubLocationAssign = (): void => {
  const testWindow = Object.create(window) as Window;
  Object.defineProperty(testWindow, "location", {
    value: { assign: dependencies.assign },
  });
  vi.stubGlobal("window", testWindow);
};

describe("SignUpForm", () => {
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

  it("preserves the validated course return path in signup, redirect, and login link", async () => {
    act(() => root.render(<SignUpForm returnTo={COURSE_RETURN_TO} />));
    fillCredentials(container);
    stubLocationAssign();

    expect(
      container.querySelector(
        'a[href="/entrar?returnTo=%2Fcomprar%2Fcurso-gratis"]'
      )
    ).not.toBeNull();

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

  it("does not preserve an invalid return prop", async () => {
    act(() => root.render(<SignUpForm returnTo="//other.example/escape" />));
    fillCredentials(container);
    stubLocationAssign();

    expect(container.querySelector('a[href="/entrar"]')).not.toBeNull();

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
