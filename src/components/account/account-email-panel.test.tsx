// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/account/profile-actions", () => ({
  cancelAccountEmailChangeAction: vi.fn(),
  requestAccountEmailChangeAction: vi.fn(),
  requestAccountEmailVerificationAction: vi.fn(),
}));

import { AccountEmailPanel } from "./account-email-panel";

describe("AccountEmailPanel", () => {
  it("shows the current address and defers editing to a dialog", () => {
    const markup = renderToStaticMarkup(
      <AccountEmailPanel
        currentEmail="student@example.test"
        emailVerified
        pendingEmailChange={null}
      />
    );

    expect(markup).toContain("student@example.test");
    expect(markup).toContain("Alterar");
    expect(markup.match(/data-slot="input-group"/g)).toHaveLength(1);
    expect(markup).toContain('data-slot="input-group-control"');
    expect(markup).toContain('aria-label="E-mail confirmado"');
    expect(markup).toContain('data-slot="icon-circle-check"');
    expect(markup).not.toContain('data-slot="badge"');
    expect(markup).not.toContain("Primeiro você confirma o e-mail atual");
    expect(markup).not.toContain("entre novamente");
  });

  it("keeps the change action beside the input and retains unverified status", () => {
    const verifiedMarkup = renderToStaticMarkup(
      <AccountEmailPanel
        currentEmail="student@example.test"
        emailVerified
        pendingEmailChange={null}
      />
    );
    const unverifiedMarkup = renderToStaticMarkup(
      <AccountEmailPanel
        currentEmail="student@example.test"
        emailVerified={false}
        pendingEmailChange={null}
      />
    );

    const rendered = document.createElement("div");
    rendered.innerHTML = verifiedMarkup;
    const inputGroup = rendered.querySelector('[data-slot="input-group"]');
    const statusAddon = rendered.querySelector('[data-align="inline-end"]');
    const statusIcon = statusAddon?.querySelector(
      'button[aria-label="E-mail confirmado"]'
    );
    const changeButton = [...rendered.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("Alterar")
    );
    expect(inputGroup?.contains(statusAddon ?? null)).toBe(true);
    expect(statusIcon).not.toBeNull();
    expect(inputGroup?.contains(changeButton ?? null)).toBe(false);
    expect(unverifiedMarkup).toContain("Confirmar e-mail");
    expect(unverifiedMarkup).toContain("Não confirmado");
    expect(unverifiedMarkup).not.toContain('data-slot="icon-circle-check"');
    expect(unverifiedMarkup).not.toContain('data-align="inline-end"');
  });
});
