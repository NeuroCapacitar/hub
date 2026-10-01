/**
 * @vitest-environment jsdom
 */

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { EmailChallengeConfirmation } from "./email-challenge-confirmation";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

describe("EmailChallengeConfirmation", () => {
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
    vi.stubGlobal("fetch", dependencies.fetch);
    window.history.replaceState(
      null,
      "",
      "/confirmar-email#token=signed-token"
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.history.replaceState(null, "", "/");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    if (hadActEnvironment) {
      globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment as boolean;
    } else {
      Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    }
  });

  it("does not consume a token while rendering GET and strips it from browser history", async () => {
    await act(async () => {
      root.render(<EmailChallengeConfirmation />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Confirmar e-mail");
    expect(dependencies.fetch).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });

  it("does not render a confirmation action for a legacy Better Auth link", async () => {
    await act(async () => {
      root.render(<EmailChallengeConfirmation legacyLink />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain(
      "Este link pertence ao fluxo anterior"
    );
    expect(container.textContent).not.toContain("Confirmar e-mail");
    expect(dependencies.fetch).not.toHaveBeenCalled();
  });
});
