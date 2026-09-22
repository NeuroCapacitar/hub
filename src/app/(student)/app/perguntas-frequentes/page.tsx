import { redirect } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Frame, FramePanel, FrameTitle } from "@/components/reui/frame";
import { SupportRequestDialog } from "@/components/support-request-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { canMutateStudentExperience } from "@/features/courses/preview";
import { getPublishedFaqItems } from "@/features/courses/server";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StudentFaqPage(): Promise<React.JSX.Element> {
  const session = await requireSession();

  if (!canMutateStudentExperience(session.role)) {
    redirect(route("/admin"));
  }

  const faqs = await getPublishedFaqItems();

  return (
    <PageContainer className="bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <PageHeader title="Perguntas frequentes" />

        <div className="flex flex-col gap-8">
          {faqs.length === 0 ? (
            <Frame
              className="bg-muted/25 [--frame-radius:var(--radius-surface)]"
              spacing="sm"
              variant="ghost"
            >
              <FrameTitle
                aria-level={2}
                className="type-section-title text-balance px-2 py-1"
                role="heading"
              >
                Nenhuma pergunta publicada
              </FrameTitle>
              <FramePanel className="border-border/70 bg-card px-5 py-5 shadow-none sm:px-6 sm:py-6">
                <p className="type-body-sm text-muted-foreground">
                  Quando a equipe publicar respostas, elas aparecerão aqui.
                </p>
              </FramePanel>
            </Frame>
          ) : (
            <section
              aria-labelledby="faq-answers-title"
              className="flex flex-col gap-4"
            >
              <h2 className="sr-only" id="faq-answers-title">
                Respostas para perguntas frequentes
              </h2>
              {faqs.map((faq) => (
                <Frame
                  className="bg-muted/25 [--frame-radius:var(--radius-surface)]"
                  key={faq.id}
                  spacing="sm"
                  variant="ghost"
                >
                  <FrameTitle
                    aria-level={3}
                    className="type-section-title text-balance px-2 py-1 text-base sm:text-lg"
                    role="heading"
                  >
                    {faq.question}
                  </FrameTitle>
                  <FramePanel className="border-border/70 bg-card px-5 py-5 shadow-none sm:px-6 sm:py-6">
                    <p className="type-body max-w-[68ch] whitespace-pre-wrap text-muted-foreground">
                      {faq.answer}
                    </p>
                  </FramePanel>
                </Frame>
              ))}
            </section>
          )}

          <Card
            className="border-border/70 bg-card/60 py-0 shadow-sm"
            size="sm"
          >
            <CardContent className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-4">
              <div className="min-w-0">
                <h2 className="type-card-title text-base">
                  Não encontrou sua resposta?
                </h2>
                <p className="type-body-sm mt-1 text-muted-foreground">
                  Nossa equipe pode ajudar você a resolver a dúvida.
                </p>
              </div>
              <SupportRequestDialog
                triggerClassName="shrink-0"
                triggerLabel="Falar com suporte"
                triggerSize="sm"
                triggerVariant="outline"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
