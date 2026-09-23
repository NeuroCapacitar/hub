import {
  Certificate01Icon,
  DashboardSquare01Icon,
  HelpSquareIcon,
  Image01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { FinanceHelp } from "@/components/admin/finance-help";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Scrollspy } from "@/components/reui/scrollspy";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  getAdminBannersData,
  getAdminFaqData,
  getAdminSettingsData,
} from "@/features/admin/server";
import { getAdminAuthMediaData } from "@/features/auth-media/server";
import { requirePermission } from "@/lib/auth-permissions";
import { canPerform } from "@/lib/auth-policy";
import { AuthMediaGallery } from "./auth-media/auth-media-gallery";
import { BannerGallery } from "./banners/banner-gallery";
import {
  CertificateSettingsForm,
  type CertificateSettingsFormValues,
} from "./certificate-settings-form";
import { FaqCreateDialog } from "./faq/faq-dialogs";
import { FaqTable } from "./faq/faq-table";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage(): Promise<React.JSX.Element> {
  const session = await requirePermission("viewSettings");
  const canManageCertificateIssuerProfile = canPerform(
    session,
    "manageCertificateIssuerProfile"
  );
  const canManageAuthMedia = canPerform(session, "manageAuthMedia");
  const canManageBanners = canPerform(session, "manageBanners");
  const canManageFaq = canPerform(session, "manageFaq");

  const [data, bannersData, authMediaData, faqData] = await Promise.all([
    getAdminSettingsData(),
    getAdminBannersData(),
    getAdminAuthMediaData(),
    getAdminFaqData(),
  ]);

  const sortedBanners = [...bannersData.banners].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  const sortedAuthMediaSlides = [...authMediaData.slides].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  const sortedFaqs = [...faqData.faqs].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  const nextSortOrder =
    sortedFaqs.length > 0
      ? Math.max(...sortedFaqs.map((f) => f.sortOrder)) + 1
      : 1;
  const issuerProfileReady = data.settings.issuerProfileComplete;
  const issuerProfileIssueLabels = {
    cnpj_invalid: "CNPJ inválido",
    cnpj_missing: "CNPJ",
    display_name_missing: "marca exibida",
    legal_name_missing: "razão social",
  } as const;
  const issuerProfileIssues = data.settings.issuerProfileIssues.map(
    (issue) => issuerProfileIssueLabels[issue]
  );
  const certificateSettings: CertificateSettingsFormValues = {
    certificateSignerName: data.settings.certificateSignerName,
    certificateSignerRole: data.settings.certificateSignerRole,
    issuerCnpj: data.settings.issuerCnpj,
    issuerDisplayName: data.settings.issuerDisplayName,
    issuerLegalName: data.settings.issuerLegalName,
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader title="Configurações globais" />

        <div className="grid grid-cols-1 gap-14 md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr]">
          <aside className="hidden md:block">
            <div className="sticky top-8">
              <nav aria-label="Seções das configurações">
                <Card className="border-none bg-card p-1.5 shadow-xs ring-1 ring-border/50">
                  <Scrollspy
                    className="flex flex-col gap-1"
                    history={false}
                    offset={96}
                  >
                    <a
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-muted-foreground text-sm transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:bg-muted data-[active=true]:text-foreground"
                      data-scrollspy-anchor="certificados"
                      href="#certificados"
                    >
                      <HugeiconsIcon
                        aria-hidden="true"
                        icon={Certificate01Icon}
                        size={18}
                        strokeWidth={1.5}
                      />
                      <span>Emissão de certificados</span>
                    </a>
                    <a
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-muted-foreground text-sm transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:bg-muted data-[active=true]:text-foreground"
                      data-scrollspy-anchor="tela-acesso"
                      href="#tela-acesso"
                    >
                      <HugeiconsIcon
                        aria-hidden="true"
                        icon={Image01Icon}
                        size={18}
                        strokeWidth={1.5}
                      />
                      <span>Tela de acesso</span>
                    </a>
                    <a
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-muted-foreground text-sm transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:bg-muted data-[active=true]:text-foreground"
                      data-scrollspy-anchor="banners-dashboard"
                      href="#banners-dashboard"
                    >
                      <HugeiconsIcon
                        aria-hidden="true"
                        icon={DashboardSquare01Icon}
                        size={18}
                        strokeWidth={1.5}
                      />
                      <span>Banners do Dashboard</span>
                    </a>
                    <a
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-muted-foreground text-sm transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:bg-muted data-[active=true]:text-foreground"
                      data-scrollspy-anchor="perguntas-frequentes"
                      href="#perguntas-frequentes"
                    >
                      <HugeiconsIcon
                        aria-hidden="true"
                        icon={HelpSquareIcon}
                        size={18}
                        strokeWidth={1.5}
                      />
                      <span>Perguntas frequentes</span>
                    </a>
                  </Scrollspy>
                </Card>
              </nav>
            </div>
          </aside>

          <div className="min-w-0 space-y-20">
            <section
              aria-labelledby="settings-certificates"
              className="grid scroll-mt-24 gap-6"
              id="certificados"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h2
                      className="type-section-title"
                      id="settings-certificates"
                    >
                      Emissão de certificados
                    </h2>
                    <FinanceHelp
                      description="Configure a identidade global usada para novas emissões. Um Curso pode definir uma assinatura própria, e Certificados já emitidos permanecem imutáveis."
                      details={[
                        "Razão social e CNPJ formam o perfil emissor e precisam ser preenchidos juntos.",
                        "A marca exibida aparece no documento quando o template não define outro valor.",
                        "A assinatura padrão é usada apenas quando o Curso não possui uma assinatura própria.",
                      ]}
                      title="Como funciona a emissão"
                    />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Dados globais usados como base nos Certificados da
                    plataforma.
                  </p>
                  {issuerProfileReady ? null : (
                    <p className="text-sm text-warning">
                      Pendências: {issuerProfileIssues.join(", ")}.
                    </p>
                  )}
                </div>
                <Badge
                  className="shrink-0"
                  variant={issuerProfileReady ? "success" : "warning"}
                >
                  {issuerProfileReady ? "Perfil pronto" : "Perfil incompleto"}
                </Badge>
              </div>

              <Card>
                <CardContent>
                  <CertificateSettingsForm
                    readOnly={!canManageCertificateIssuerProfile}
                    settings={certificateSettings}
                  />
                </CardContent>
              </Card>
            </section>

            <section className="grid scroll-mt-24 gap-6" id="tela-acesso">
              <div className="space-y-1">
                <h2 className="type-section-title">Tela de acesso</h2>
                <p className="text-muted-foreground text-sm">
                  Até cinco imagens 8:7 exibidas na autenticação pública.
                </p>
              </div>
              <AuthMediaGallery
                initialSlides={sortedAuthMediaSlides}
                readOnly={!canManageAuthMedia}
              />
            </section>

            <section className="grid scroll-mt-24 gap-6" id="banners-dashboard">
              <div className="space-y-1">
                <h2 className="type-section-title">Banners do Dashboard</h2>
                <p className="text-muted-foreground text-sm">
                  Até cinco banners cadastrados para a página inicial da área do
                  Aluno.
                </p>
              </div>
              <BannerGallery
                initialBanners={sortedBanners}
                readOnly={!canManageBanners}
              />
            </section>

            <section
              className="grid scroll-mt-24 gap-6"
              id="perguntas-frequentes"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="type-section-title">Perguntas frequentes</h2>
                  <p className="text-muted-foreground text-sm">
                    Respostas publicadas na área do Aluno.
                  </p>
                </div>
                {canManageFaq ? (
                  <FaqCreateDialog nextSortOrder={nextSortOrder} />
                ) : (
                  <Badge className="shrink-0" variant="outline">
                    Somente leitura
                  </Badge>
                )}
              </div>
              <FaqTable faqs={sortedFaqs} readOnly={!canManageFaq} />
            </section>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
