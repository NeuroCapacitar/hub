import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/account/profile-panel", () => ({
  AccountProfilePanel: () => <div>profile form</div>,
}));
vi.mock("@/components/account/account-email-panel", () => ({
  AccountEmailPanel: () => <div>email controls</div>,
}));
vi.mock("@/components/account/account-security-panel", () => ({
  AccountSecurityPanel: ({
    accountSettingsPath,
  }: {
    accountSettingsPath: string;
  }) => <div>sign-in controls {accountSettingsPath}</div>,
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    GOOGLE_CLIENT_ID: undefined,
    GOOGLE_CLIENT_SECRET: undefined,
  }),
}));

import { AccountProfileSection } from "./account-settings-sections";

describe("account settings sections", () => {
  const security = {
    avatarMode: "initials" as const,
    googleImageAvailable: false,
    hasGoogleAccount: false,
    pendingEmailChange: null,
  };
  const session = {
    emailVerified: true,
    platformBlockedAt: null,
    platformBlockedReason: null,
    role: "student" as const,
    supportPermissionGrants: [],
    supportPermissionViews: [],
    user: {
      email: "student@example.test",
      id: "student-1",
      image: null,
      name: "Student",
    },
  };

  it("groups personal data, email, and login methods in one profile section", () => {
    const markup = renderToStaticMarkup(
      <AccountProfileSection
        security={security}
        session={session}
        settingsHref="/app/configuracoes#acesso-conta"
      />
    );

    expect(markup).toContain('id="minha-conta"');
    expect(markup).toContain('id="acesso-conta"');
    expect(markup).toContain("Minha conta");
    expect(markup).toContain("gap-12");
    expect(markup).toContain("gap-8");
    expect(markup).toContain(
      "Gerencie suas informações pessoais e métodos de entrada."
    );
    expect(markup).toContain("Informações pessoais");
    expect(markup).toContain("profile form");
    expect(markup).toContain("email controls");
    expect(markup).toContain("Métodos de entrada");
    expect(markup).not.toContain('data-slot="separator"');
    expect(markup).toContain(
      "sign-in controls /app/configuracoes#acesso-conta"
    );
    expect(markup.match(/data-slot="card"/g)).toHaveLength(1);
    expect(markup.indexOf("profile form")).toBeLessThan(
      markup.indexOf("email controls")
    );
    expect(markup.indexOf("email controls")).toBeLessThan(
      markup.indexOf("sign-in controls")
    );
  });
});
