// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  canPerform: vi.fn(),
  getAccountSecuritySummary: vi.fn(),
  getAdminAuthMediaData: vi.fn(),
  getAdminBannersData: vi.fn(),
  getAdminFaqData: vi.fn(),
  getAdminSettingsData: vi.fn(),
  hasAdminSurfaceAccess: vi.fn(),
  redirect: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: dependencies.redirect,
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/session", () => ({
  requireSession: dependencies.requireSession,
}));
vi.mock("@/lib/auth-policy", () => ({
  canPerform: dependencies.canPerform,
  hasAdminSurfaceAccess: dependencies.hasAdminSurfaceAccess,
}));
vi.mock("@/features/account/profile", () => ({
  getAccountSecuritySummary: dependencies.getAccountSecuritySummary,
}));
vi.mock("@/features/admin/server", () => ({
  getAdminAuthMediaData: dependencies.getAdminAuthMediaData,
  getAdminBannersData: dependencies.getAdminBannersData,
  getAdminFaqData: dependencies.getAdminFaqData,
  getAdminSettingsData: dependencies.getAdminSettingsData,
}));
vi.mock("@/features/auth-media/server", () => ({
  getAdminAuthMediaData: dependencies.getAdminAuthMediaData,
}));
vi.mock("@/components/account/account-settings-sections", () => ({
  AccountProfileSection: ({ settingsHref }: { settingsHref: string }) => (
    <section id="minha-conta">
      Perfil da conta · Métodos de entrada · Google · {settingsHref}
    </section>
  ),
}));
vi.mock("@/components/page-container", () => ({
  PageContainer: ({ children }: React.PropsWithChildren) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/components/page-header", () => ({
  PageHeader: ({
    title,
    description,
  }: {
    title: string;
    description?: string;
  }) => (
    <header>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </header>
  ),
}));
vi.mock("@/components/admin/finance-help", () => ({
  FinanceHelp: () => <span />,
}));
vi.mock("./auth-media/auth-media-gallery", () => ({
  AuthMediaGallery: () => <div />,
}));
vi.mock("./banners/banner-gallery", () => ({
  BannerGallery: () => <div />,
}));
vi.mock("./certificate-settings-form", () => ({
  CertificateSettingsForm: () => <div />,
}));
vi.mock("./faq/faq-dialogs", () => ({
  FaqCreateDialog: () => <button type="button">Criar pergunta</button>,
}));
vi.mock("./faq/faq-table", () => ({
  FaqTable: () => <div />,
}));

import AdminSettingsPage from "./page";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

const staffSession = (role: "admin" | "support") => ({
  authenticatedAt: new Date(),
  emailVerified: true,
  platformBlockedAt: null,
  platformBlockedReason: null,
  role,
  supportPermissionGrants: [],
  supportPermissionViews: [],
  user: {
    email: `${role}@example.test`,
    id: `${role}-1`,
    image: null,
    name: role,
  },
});

describe("AdminSettingsPage", () => {
  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
      root = null;
    }
    document.body.innerHTML = "";
  });

  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.redirect.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
    dependencies.hasAdminSurfaceAccess.mockReturnValue(true);
    dependencies.getAccountSecuritySummary.mockResolvedValue({
      avatarMode: "initials",
      googleImageAvailable: false,
      hasGoogleAccount: false,
      pendingEmailChange: null,
    });
    dependencies.getAdminSettingsData.mockResolvedValue({
      settings: {
        issuerCnpj: null,
        issuerDisplayName: null,
        issuerLegalName: null,
        issuerProfileComplete: true,
        issuerProfileIssues: [],
      },
    });
    dependencies.getAdminBannersData.mockResolvedValue({ banners: [] });
    dependencies.getAdminAuthMediaData.mockResolvedValue({ slides: [] });
    dependencies.getAdminFaqData.mockResolvedValue({ faqs: [] });
  });

  it("shows only personal account settings to staff without product-settings access", async () => {
    dependencies.requireSession.mockResolvedValue(staffSession("support"));
    dependencies.canPerform.mockReturnValue(false);

    const markup = renderToStaticMarkup(await AdminSettingsPage());

    expect(markup).toContain("Perfil");
    expect(markup).toContain("Métodos de entrada");
    expect(markup).toContain("Google");
    expect(markup).not.toContain('role="tab"');
    expect(markup).not.toContain("Emissão de certificados");
    expect(dependencies.getAccountSecuritySummary).toHaveBeenCalledWith(
      "support-1"
    );
    expect(dependencies.getAdminSettingsData).not.toHaveBeenCalled();
    expect(dependencies.getAdminBannersData).not.toHaveBeenCalled();
    expect(dependencies.getAdminAuthMediaData).not.toHaveBeenCalled();
    expect(dependencies.getAdminFaqData).not.toHaveBeenCalled();
  });

  it("groups global settings into three tabs and keeps account methods with profile", async () => {
    dependencies.requireSession.mockResolvedValue(staffSession("admin"));
    dependencies.canPerform.mockImplementation(
      (_session: unknown, permission: string) => permission === "viewSettings"
    );

    const markup = renderToStaticMarkup(await AdminSettingsPage());

    expect(markup.match(/role="tab"/g)).toHaveLength(3);
    expect(markup).toContain('role="tab"');
    expect(markup).toContain("Perfil");
    expect(markup).toContain("Métodos de entrada");
    expect(markup).toContain("Google");
    expect(markup).toContain("Certificados");
    expect(markup).toContain("Plataforma");
    expect(markup).toContain("max-w-4xl");
    expect(markup).toContain("max-w-4xl flex-col gap-16");
    expect(markup).toContain("w-full gap-12");
    expect(markup).not.toContain("Tela de acesso");
    expect(markup).not.toContain("Banners do Dashboard");
    expect(markup).not.toContain("Perguntas frequentes");
  });

  it("maps old platform tab URLs to the grouped platform tab", async () => {
    dependencies.requireSession.mockResolvedValue(staffSession("admin"));
    dependencies.canPerform.mockImplementation(
      (_session: unknown, permission: string) => permission === "viewSettings"
    );

    const markup = renderToStaticMarkup(
      await AdminSettingsPage({
        searchParams: Promise.resolve({ tab: "perguntas-frequentes" }),
      })
    );

    expect(markup).toContain("Plataforma");
    expect(markup).toContain("Banners do Dashboard");
    expect(markup).toContain("Perguntas frequentes");
  });

  it.each([
    "admin",
    "support",
  ] as const)("%s sees only the selected panel across every settings tab", async (role) => {
    dependencies.requireSession.mockResolvedValue(staffSession(role));
    dependencies.canPerform.mockImplementation(
      (_session: unknown, permission: string) => permission === "viewSettings"
    );

    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(await AdminSettingsPage());
    });

    expect(
      host.querySelector("main > div")?.classList.contains("max-w-4xl")
    ).toBe(true);
    const tabsList = host.querySelector('[role="tablist"]');
    expect(tabsList?.classList.contains("grid-cols-2")).toBe(true);
    expect(tabsList?.classList.contains("sm:flex")).toBe(true);
    for (const trigger of host.querySelectorAll('[role="tab"]')) {
      expect(trigger.classList.contains("flex-1")).toBe(true);
      expect(trigger.classList.contains("py-1.5")).toBe(true);
      expect(trigger.classList.contains("min-h-11")).toBe(false);
    }

    const expectOnlySelectedPanel = (): void => {
      const panels = [
        ...host.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
      ];
      const selectedPanels = panels.filter(
        (panel) => panel.dataset.state === "active"
      );

      expect(selectedPanels).toHaveLength(1);
      for (const panel of panels) {
        if (panel.dataset.state === "inactive") {
          expect(
            panel.hidden ||
              panel.classList.contains("data-[state=inactive]:hidden")
          ).toBe(true);
        }
      }
    };

    expectOnlySelectedPanel();
    expect(host.textContent).toContain("Métodos de entrada");
    for (const label of ["Certificados", "Plataforma", "Perfil"]) {
      const tab = [...host.querySelectorAll('[role="tab"]')].find((candidate) =>
        candidate.textContent?.includes(label)
      );
      expect(tab).toBeDefined();

      act(() => {
        tab?.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            button: 0,
            cancelable: true,
          })
        );
      });

      expect(tab?.getAttribute("aria-selected")).toBe("true");
      expectOnlySelectedPanel();
      if (label === "Plataforma") {
        expect(host.textContent).toContain("Tela de acesso");
        expect(host.textContent).toContain("Banners do Dashboard");
        expect(host.textContent).toContain("Perguntas frequentes");
      }
    }
  });

  it("shows Support's personal profile without tabs when global access is absent", async () => {
    dependencies.requireSession.mockResolvedValue(staffSession("support"));
    dependencies.canPerform.mockReturnValue(false);

    const markup = renderToStaticMarkup(await AdminSettingsPage());

    expect(markup).toContain("Perfil");
    expect(markup).toContain("Métodos de entrada");
    expect(markup).toContain("Google");
    expect(markup).not.toContain('role="tab"');
    expect(markup).toContain("max-w-4xl");
    expect(markup).not.toContain("Certificados");
    expect(markup).not.toContain("Banners do Dashboard");
  });
});
