import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dependencies = vi.hoisted(() => ({
  getAdminAuthMediaData: vi.fn(),
  getAdminBannersData: vi.fn(),
  getAdminFaqData: vi.fn(),
  getAdminSettingsData: vi.fn(),
  requirePermission: vi.fn(),
  saveSettingsAction: vi.fn(),
}));

vi.mock("@/features/admin/actions", () => ({
  saveSettingsAction: dependencies.saveSettingsAction,
}));
vi.mock("@/features/admin/server", () => ({
  getAdminBannersData: dependencies.getAdminBannersData,
  getAdminFaqData: dependencies.getAdminFaqData,
  getAdminSettingsData: dependencies.getAdminSettingsData,
}));
vi.mock("@/features/auth-media/server", () => ({
  getAdminAuthMediaData: dependencies.getAdminAuthMediaData,
}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));
vi.mock("./banners/banner-gallery", () => ({
  BannerGallery: () => <div>Banners renderizados</div>,
}));
vi.mock("./auth-media/auth-media-gallery", () => ({
  AuthMediaGallery: () => <div>Mídias de acesso renderizadas</div>,
}));
vi.mock("./faq/faq-dialogs", () => ({
  FaqCreateDialog: () => <button type="button">Nova pergunta</button>,
}));
vi.mock("./faq/faq-table", () => ({
  FaqTable: () => <div>FAQs renderizadas</div>,
}));

import AdminSettingsPage from "./page";

describe("AdminSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requirePermission.mockResolvedValue({
      role: "admin",
      supportPermissionGrants: [],
    });
    dependencies.getAdminSettingsData.mockResolvedValue({
      settings: {
        issuerCnpj: "04.252.011/0001-10",
        issuerDisplayName: "Empresa",
        issuerLegalName: "Empresa LTDA",
        issuerProfileComplete: true,
        issuerProfileIssues: [],
        lastUpdatedAt: null,
        lastUpdatedBy: null,
      },
    });
    dependencies.getAdminBannersData.mockResolvedValue({ banners: [] });
    dependencies.getAdminAuthMediaData.mockResolvedValue({ slides: [] });
    dependencies.getAdminFaqData.mockResolvedValue({ faqs: [] });
  });

  it("keeps configuration focused on certificates and editorial content", async () => {
    const markup = renderToStaticMarkup(await AdminSettingsPage());

    expect(markup).toContain("Emissão de certificados");
    expect(markup).not.toContain("Perfil e assinatura");
    expect(markup).toContain("Instituição emissora");
    expect(markup).not.toContain("Assinatura padrão");
    expect(markup).not.toContain('name="certificateSignerName"');
    expect(markup).not.toContain('name="certificateSignerRole"');
    expect(markup).toContain("Perfil pronto");
    expect(markup).not.toContain("Ver histórico");
    expect(markup).not.toContain("Última alteração em");
    expect(markup).not.toContain("Conteúdo editorial");
    expect(markup).toContain('data-scrollspy-anchor="certificados"');
    expect(markup).toContain('data-scrollspy-anchor="tela-acesso"');
    expect(markup).toContain('data-scrollspy-anchor="banners-dashboard"');
    expect(markup).toContain('data-scrollspy-anchor="perguntas-frequentes"');
    expect(markup).toContain("Banners renderizados");
    expect(markup).toContain("Mídias de acesso renderizadas");
    expect(markup).toContain("FAQs renderizadas");
    expect(markup).toContain('href="/admin/configuracoes/design-system"');
    expect(markup).toContain("Sistema visual");
    expect(markup).not.toContain("JMVStream");
    expect(dependencies.requirePermission).toHaveBeenCalledWith("viewSettings");
  });
});
