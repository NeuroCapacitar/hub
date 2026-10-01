import { PaintBoardIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountProfileSection } from "@/components/account/account-settings-sections";
import { FinanceHelp } from "@/components/admin/finance-help";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAccountSecuritySummary } from "@/features/account/profile";
import {
  getAdminBannersData,
  getAdminFaqData,
  getAdminSettingsData,
} from "@/features/admin/server";
import { getAdminAuthMediaData } from "@/features/auth-media/server";
import { canPerform, hasAdminSurfaceAccess } from "@/lib/auth-policy";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import { AdminSettingsTabs } from "./admin-settings-tabs";
import { AuthMediaGallery } from "./auth-media/auth-media-gallery";
import { BannerGallery } from "./banners/banner-gallery";
import {
  CertificateSettingsForm,
  type CertificateSettingsFormValues,
} from "./certificate-settings-form";
import { FaqCreateDialog } from "./faq/faq-dialogs";
import { FaqTable } from "./faq/faq-table";

export const dynamic = "force-dynamic";

const adminSettingsTabValues = [
  "perfil",
  "certificados",
  "plataforma",
] as const;
const getDefaultAdminSettingsTab = (
  requestedTab: string | undefined
): (typeof adminSettingsTabValues)[number] => {
  if (
    requestedTab === "perfil" ||
    requestedTab === "certificados" ||
    requestedTab === "plataforma"
  ) {
    return requestedTab;
  }
  if (
    requestedTab === "tela-acesso" ||
    requestedTab === "banners" ||
    requestedTab === "perguntas-frequentes"
  ) {
    return "plataforma";
  }
  if (requestedTab === "acesso") {
    return "perfil";
  }
  return "perfil";
};

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string | string[] }>;
} = {}): Promise<React.JSX.Element> {
  const query = (await searchParams) ?? {};
  const requestedTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const defaultTab = getDefaultAdminSettingsTab(requestedTab);
  const session = await requireSession();
  if (!hasAdminSurfaceAccess(session)) {
    redirect(route("/app"));
  }

  const canViewSettings = canPerform(session, "viewSettings");
  const securityPromise = getAccountSecuritySummary(session.user.id);
  if (!canViewSettings) {
    const security = await securityPromise;

    return (
      <PageContainer>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-16">
          <PageHeader
            description="Dados pessoais e método de entrada da sua conta."
            title="Configurações"
          />
          <AccountProfileSection
            security={security}
            session={session}
            settingsHref="/admin/configuracoes#acesso-conta"
          />
        </div>
      </PageContainer>
    );
  }

  const canManageCertificateIssuerProfile = canPerform(
    session,
    "manageCertificateIssuerProfile"
  );
  const canManageAuthMedia = canPerform(session, "manageAuthMedia");
  const canManageBanners = canPerform(session, "manageBanners");
  const canManageFaq = canPerform(session, "manageFaq");

  const [security, [data, bannersData, authMediaData, faqData]] =
    await Promise.all([
      securityPromise,
      Promise.all([
        getAdminSettingsData(),
        getAdminBannersData(),
        getAdminAuthMediaData(),
        getAdminFaqData(),
      ]),
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
    issuerCnpj: data.settings.issuerCnpj,
    issuerDisplayName: data.settings.issuerDisplayName,
    issuerLegalName: data.settings.issuerLegalName,
  };

  return (
    <PageContainer>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-16">
        <PageHeader
          actions={
            <Button asChild variant="outline">
              <Link href={route("/admin/configuracoes/design-system")}>
                <HugeiconsIcon
                  aria-hidden="true"
                  data-icon="inline-start"
                  icon={PaintBoardIcon}
                  size={16}
                  strokeWidth={1.5}
                />
                Sistema visual
              </Link>
            </Button>
          }
          description="Conta pessoal e ajustes gerais do Hub."
          title="Configurações"
        />

        <AdminSettingsTabs
          certificates={
            <section
              aria-labelledby="settings-certificates"
              className="grid gap-6"
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
                      description="Configure a identidade global da organização. Nome e cargo do signatário são definidos em cada Curso; Certificados já emitidos permanecem imutáveis."
                      details={[
                        "Razão social e CNPJ formam o perfil emissor e precisam ser preenchidos juntos.",
                        "A marca exibida aparece no documento quando o template não define outro valor.",
                        "Nome e cargo do signatário são definidos em cada Curso e obrigatórios para publicar; a imagem visual é opcional.",
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
          }
          defaultTab={defaultTab}
          platform={
            <div className="grid gap-16">
              <section className="grid gap-6" id="tela-acesso">
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
              <section className="grid gap-6" id="banners-dashboard">
                <div className="space-y-1">
                  <h2 className="type-section-title">Banners do Dashboard</h2>
                  <p className="text-muted-foreground text-sm">
                    Até cinco banners cadastrados para a página inicial da área
                    do Aluno.
                  </p>
                </div>
                <BannerGallery
                  initialBanners={sortedBanners}
                  readOnly={!canManageBanners}
                />
              </section>
              <section className="grid gap-6" id="perguntas-frequentes">
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
          }
          profile={
            <AccountProfileSection
              security={security}
              session={session}
              settingsHref="/admin/configuracoes?tab=perfil#acesso-conta"
            />
          }
        />
      </div>
    </PageContainer>
  );
}
