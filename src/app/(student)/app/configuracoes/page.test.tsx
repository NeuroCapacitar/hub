import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getAccountSecuritySummary: vi.fn(),
  getLearningAnalyticsPreference: vi.fn(),
  redirect: vi.fn(),
  requireAccountSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: dependencies.redirect,
}));
vi.mock("@/lib/session", () => ({
  requireAccountSession: dependencies.requireAccountSession,
}));
vi.mock("@/features/account/profile", () => ({
  getAccountSecuritySummary: dependencies.getAccountSecuritySummary,
}));
vi.mock("@/features/learning-analytics/server", () => ({
  getLearningAnalyticsPreference: dependencies.getLearningAnalyticsPreference,
}));
vi.mock("@/components/account/account-settings-sections", () => ({
  AccountProfileSection: ({ settingsHref }: { settingsHref: string }) => (
    <section id="minha-conta">
      Perfil da conta · Métodos de entrada · Google · {settingsHref}
    </section>
  ),
}));
vi.mock("@/components/learning-analytics/analytics-switch", () => ({
  AnalyticsSwitch: () => <button type="button">Preferência</button>,
}));

import StudentSettingsPage from "./page";

describe("StudentSettingsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.requireAccountSession.mockResolvedValue({
      authenticatedAt: new Date(),
      emailVerified: true,
      platformBlockedAt: null,
      platformBlockedReason: null,
      role: "student",
      supportPermissionGrants: [],
      supportPermissionViews: [],
      user: {
        email: "student@example.test",
        id: "student-1",
        image: null,
        name: "Student",
      },
    });
    dependencies.redirect.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
    dependencies.getAccountSecuritySummary.mockResolvedValue({
      avatarMode: "initials",
      googleImageAvailable: false,
      hasGoogleAccount: false,
      pendingEmailChange: null,
    });
    dependencies.getLearningAnalyticsPreference.mockResolvedValue(true);
  });

  it("shows settings in a centered vertical layout without tabs", async () => {
    const markup = renderToStaticMarkup(await StudentSettingsPage());

    expect(dependencies.requireAccountSession).toHaveBeenCalledOnce();
    expect(markup).toContain("Configurações");
    expect(markup).toContain("Perfil");
    expect(markup).toContain("Métodos de entrada");
    expect(markup).toContain("Google");
    expect(markup).toContain("/app/configuracoes#acesso-conta");
    expect(markup).toContain("Privacidade e dados");
    expect(markup).toContain("Melhoria das aulas");
    expect(markup).toContain("max-w-4xl");
    expect(markup).not.toContain('role="tab"');
    expect(dependencies.getAccountSecuritySummary).toHaveBeenCalledWith(
      "student-1"
    );
    expect(dependencies.getLearningAnalyticsPreference).toHaveBeenCalledWith({
      userId: "student-1",
    });
  });

  it("omits the privacy section when its preference is unavailable", async () => {
    dependencies.getLearningAnalyticsPreference.mockResolvedValue(null);

    const markup = renderToStaticMarkup(await StudentSettingsPage());

    expect(markup).toContain("Perfil");
    expect(markup).toContain("Métodos de entrada");
    expect(markup).not.toContain("Privacidade e dados");
    expect(markup).not.toContain('role="tab"');
  });

  it("redirects staff to their existing account settings", async () => {
    dependencies.requireAccountSession.mockResolvedValue({
      authenticatedAt: new Date(),
      emailVerified: true,
      platformBlockedAt: null,
      platformBlockedReason: null,
      role: "admin",
      supportPermissionGrants: [],
      supportPermissionViews: [],
      user: {
        email: "admin@example.test",
        id: "admin-1",
        image: null,
        name: "Admin",
      },
    });

    await expect(StudentSettingsPage()).rejects.toThrow(
      "redirect:/admin/configuracoes#minha-conta"
    );
  });
});
