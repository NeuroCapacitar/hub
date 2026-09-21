import { Certificate01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  type CertificateRecord,
  getCertificatesForUser,
} from "@/features/certificates/server";
import { canMutateStudentExperience } from "@/features/courses/preview";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import { CertificateCard } from "./certificate-card";
import { CertificateHistoryCard } from "./certificate-history-card";
import { CertificateHistorySheet } from "./certificate-history-sheet";
import { PendingCertificateRefresh } from "./pending-certificate-refresh";

export const dynamic = "force-dynamic";

export default async function MyCertificatesPage(): Promise<React.JSX.Element> {
  const session = await requireSession();

  if (!canMutateStudentExperience(session.role)) {
    redirect(route("/admin"));
  }

  const certificates = await getCertificatesForUser(session.user.id);
  const activeCertificates = certificates.filter(
    (certificate) => certificate.status !== "revoked"
  );
  const revokedCertificates = certificates.filter(
    (certificate) => certificate.status === "revoked"
  );
  const hasPendingCertificate = certificates.some(
    (certificate) =>
      certificate.status === "valid" && certificate.renderStatus === "pending"
  );

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      {hasPendingCertificate ? <PendingCertificateRefresh enabled /> : null}
      <div className="flex flex-col gap-8">
        <PageHeader title="Seus certificados" />

        <header className="flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-learning-complete/15 text-learning-complete"
            >
              <HugeiconsIcon
                icon={Certificate01Icon}
                size={22}
                strokeWidth={1.5}
              />
            </div>
            <div>
              <h2 className="type-section-title" id="certificates-intro-title">
                Suas conquistas
              </h2>
              <p className="mt-1.5 text-muted-foreground text-sm leading-6">
                Cada certificado guarda um passo que você construiu. Consulte,
                baixe ou compartilhe quando quiser.
              </p>
            </div>
          </div>
          {revokedCertificates.length > 0 ? (
            <CertificateHistorySheet
              certificateCount={revokedCertificates.length}
            >
              <div className="grid gap-3">
                {revokedCertificates.map((certificate) => (
                  <CertificateHistoryCard
                    certificate={certificate}
                    key={certificate.code}
                  />
                ))}
              </div>
            </CertificateHistorySheet>
          ) : null}
        </header>

        {certificates.length === 0 ? <EmptyCertificatesState /> : null}

        {activeCertificates.length > 0 ? (
          <CertificateGrid certificates={activeCertificates} />
        ) : null}
      </div>
    </PageContainer>
  );
}

function CertificateGrid({
  certificates,
}: {
  certificates: readonly CertificateRecord[];
}): React.JSX.Element {
  return (
    <section className="grid max-w-6xl gap-5 xl:grid-cols-2">
      {certificates.map((certificate) => (
        <CertificateCard certificate={certificate} key={certificate.code} />
      ))}
    </section>
  );
}

function EmptyCertificatesState(): React.JSX.Element {
  return (
    <Empty className="min-h-64 max-w-6xl border border-dashed bg-card/40">
      <EmptyHeader>
        <EmptyMedia
          className="bg-learning-complete/15 text-learning-complete"
          variant="icon"
        >
          <HugeiconsIcon aria-hidden="true" icon={Certificate01Icon} />
        </EmptyMedia>
        <EmptyTitle as="h2">Seu primeiro certificado começa aqui</EmptyTitle>
        <EmptyDescription>
          Conclua as aulas obrigatórias de um curso com certificado para liberar
          o documento e o link público de validação.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href={route("/app")}>Voltar para meus cursos</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
