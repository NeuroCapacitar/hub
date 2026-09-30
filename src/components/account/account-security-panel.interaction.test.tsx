// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  linkSocial: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    linkSocial: dependencies.linkSocial,
  },
}));

import { AccountSecurityPanel } from "./account-security-panel";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  document.body.innerHTML = "";
  vi.resetAllMocks();
});

describe("AccountSecurityPanel", () => {
  it("connects Google from the profile section", async () => {
    dependencies.linkSocial.mockResolvedValue({ error: null });
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    act(() => {
      root?.render(
        <AccountSecurityPanel
          accountSettingsPath="/admin/configuracoes?tab=perfil#acesso-conta"
          emailVerified
          googleOAuthEnabled
          hasGoogleAccount={false}
        />
      );
    });

    const connectButton = [...host.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Conectar Google")
    );
    expect(connectButton).toBeDefined();
    expect(host.querySelector("form")).toBeNull();
    expect(host.textContent).not.toContain("Senha");

    await act(async () => {
      connectButton?.click();
      await Promise.resolve();
    });

    expect(dependencies.linkSocial).toHaveBeenCalledWith({
      callbackURL:
        "http://localhost:3000/admin/configuracoes?tab=perfil#acesso-conta",
      provider: "google",
    });
  });

  it("keeps Google linking disabled until email verification", () => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    act(() => {
      root?.render(
        <AccountSecurityPanel
          accountSettingsPath="/app/configuracoes#acesso-conta"
          emailVerified={false}
          googleOAuthEnabled
          hasGoogleAccount={false}
        />
      );
    });

    const connectButton = [...host.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Conectar Google")
    );
    expect(connectButton?.disabled).toBe(true);
    expect(host.textContent).toContain("Confirme seu e-mail para conectar.");
    expect(host.querySelector("form")).toBeNull();
  });
});
