// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/account/profile-actions", () => ({
  cancelAccountEmailChangeAction: vi.fn(),
  requestAccountEmailChangeAction: vi.fn(),
  requestAccountEmailVerificationAction: vi.fn(),
}));

import { AccountEmailPanel } from "./account-email-panel";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observed = false;

      disconnect(): void {
        this.observed = false;
      }

      observe(): void {
        this.observed = true;
      }

      unobserve(): void {
        this.observed = false;
      }
    }
  );
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("AccountEmailPanel interaction", () => {
  it("shows the confirmation tooltip when the status icon receives focus", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    act(() => {
      root?.render(
        <AccountEmailPanel
          currentEmail="student@example.test"
          emailVerified
          pendingEmailChange={null}
        />
      );
    });

    const trigger = host.querySelector<HTMLButtonElement>(
      'button[aria-label="E-mail confirmado"]'
    );
    expect(trigger).not.toBeNull();
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull();

    await act(async () => {
      trigger?.focus();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(
      document.body.querySelector('[role="tooltip"]')?.textContent
    ).toContain("Confirmado");
  });
});
