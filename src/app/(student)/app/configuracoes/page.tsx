import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountProfileSection } from "@/components/account/account-settings-sections";
import { AnalyticsSwitch } from "@/components/learning-analytics/analytics-switch";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getAccountSecuritySummary } from "@/features/account/profile";
import { getLearningAnalyticsPreference } from "@/features/learning-analytics/server";
import { route } from "@/lib/routes";
import { requireAccountSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Configurações",
};
export const dynamic = "force-dynamic";

export default async function StudentSettingsPage(): Promise<React.JSX.Element> {
  const session = await requireAccountSession();
  if (session.role !== "student") {
    redirect(route("/admin/configuracoes#minha-conta"));
  }
  const [security, analyticsEnabled] = await Promise.all([
    getAccountSecuritySummary(session.user.id),
    getLearningAnalyticsPreference({ userId: session.user.id }),
  ]);

  return (
    <PageContainer>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-16">
        <PageHeader
          description="Dados da conta e privacidade das aulas."
          title="Configurações"
        />

        <AccountProfileSection
          security={security}
          session={session}
          settingsHref="/app/configuracoes#acesso-conta"
        />
        {analyticsEnabled === null ? null : (
          <section
            aria-labelledby="privacy-settings-title"
            className="grid gap-5"
            id="privacidade"
          >
            <div className="space-y-1">
              <h2 className="type-section-title" id="privacy-settings-title">
                Privacidade e dados
              </h2>
              <p className="text-muted-foreground text-sm">
                Escolha como os dados mínimos de uso são usados para melhorar as
                aulas.
              </p>
            </div>
            <Card className="border-border/70 shadow-none" size="sm">
              <CardContent>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="max-w-xl space-y-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-medium text-foreground text-sm sm:text-base">
                        Melhoria das aulas
                      </h3>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              aria-label="Mais informações sobre melhoria das aulas"
                              className="inline-flex cursor-help items-center rounded-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              type="button"
                            >
                              <HugeiconsIcon
                                aria-hidden="true"
                                icon={InformationCircleIcon}
                                size={16}
                              />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            className="max-w-xs p-3 text-xs leading-normal"
                            side="top"
                            sideOffset={6}
                          >
                            <p>
                              Coletamos dados mínimos de uso (progresso e falhas
                              técnicas) apenas para aprimorar as aulas. Ao
                              desativar, os registros identificáveis são
                              removidos. Saiba mais em nossa{" "}
                              <a
                                className="font-medium underline hover:text-foreground"
                                href="/politica-de-privacidade"
                              >
                                política de privacidade
                              </a>
                              .
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="text-muted-foreground text-xs sm:text-sm">
                      Permite coletar métricas anônimas de uso para identificar
                      e corrigir falhas nas aulas.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <AnalyticsSwitch enabled={analyticsEnabled} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </PageContainer>
  );
}
