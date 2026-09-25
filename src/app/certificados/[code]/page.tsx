import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { PageContainer } from "@/components/page-container";
import { CERTIFICATE_PREVIEW_DIMENSIONS } from "@/features/certificates/preview";
import { consumePublicCertificateLookup } from "@/features/certificates/public-rate-limit";
import {
  type CertificateRecord,
  getCertificateByCode,
  getRevokedCertificateTombstoneByCode,
} from "@/features/certificates/server";
import { CertificatePublicActions } from "./certificate-public-actions";
import { CertificatePublicCode } from "./certificate-public-code";
import { CertificatePublicStatus } from "./certificate-public-status";

const getUnavailableDocumentMessage = (
  certificate: CertificateRecord | null
): string => {
  if (certificate?.status === "revoked") {
    return "A prévia e o download deste certificado não estão mais disponíveis porque ele foi revogado.";
  }
  if (certificate?.renderStatus === "failed") {
    return "Não foi possível preparar o documento. Entre em contato com o Suporte.";
  }
  return "O documento ficará disponível quando o certificado estiver pronto.";
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

export default async function CertificateValidationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<React.JSX.Element> {
  const { code } = await params;
  const limit = await consumePublicCertificateLookup(await headers());

  if (limit === "limited") {
    notFound();
  }
  const certificate = await getCertificateByCode(code);
  const tombstone = certificate
    ? null
    : await getRevokedCertificateTombstoneByCode(code);

  if (!(certificate || tombstone)) {
    notFound();
  }

  const publicCode = certificate?.code ?? code;
  const pdfHref = `/certificados/${encodeURIComponent(publicCode)}/pdf`;
  const previewHref = `/certificados/${encodeURIComponent(publicCode)}/preview`;
  const isReady =
    certificate?.status === "valid" && certificate.renderStatus === "ready";
  const revokedAt = certificate?.revokedAt ?? tombstone?.revokedAt ?? null;
  const formattedRevokedAt = revokedAt
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "long",
        timeZone: "America/Sao_Paulo",
      }).format(revokedAt)
    : null;
  const unavailableDocumentMessage = getUnavailableDocumentMessage(certificate);

  return (
    <PageContainer
      as="main"
      className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8 sm:py-8 lg:px-12"
    >
      <div className="mx-auto max-w-[1400px]" data-certificate-layout="split">
        <header className="mb-8 flex items-center justify-between border-border/60 border-b pb-4">
          <BrandLogo
            className="h-8 w-auto object-contain object-left"
            preload
          />
          <div className="ml-auto text-right">
            <h1 className="font-heading font-semibold text-sm">
              Verificação de certificado
            </h1>
            <p className="text-muted-foreground text-xs">
              NeuroCapacitar · Credencial digital
            </p>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(18rem,0.55fr)_minmax(0,1.55fr)] lg:gap-12">
          <aside
            className="order-first min-w-0 lg:border-border/60 lg:border-r lg:pr-10"
            data-certificate-panel="true"
          >
            {certificate ? (
              <div>
                <p className="text-muted-foreground text-sm">Emitido para</p>
                <p className="mt-2 font-heading font-semibold text-xl">
                  {certificate.studentName}
                </p>
                <p className="mt-3 text-muted-foreground text-sm leading-6">
                  Curso{" "}
                  <strong className="font-semibold text-foreground">
                    {certificate.courseTitle}
                  </strong>
                </p>
              </div>
            ) : (
              <div>
                <p className="text-muted-foreground text-sm">
                  Consulta pública
                </p>
                <p className="mt-2 text-muted-foreground text-sm leading-6">
                  Os dados pessoais e do curso não são exibidos após o prazo de
                  retenção.
                </p>
              </div>
            )}

            <CertificatePublicCode code={publicCode} />
          </aside>

          <section
            aria-labelledby="certificate-pdf-heading"
            className="min-w-0"
            data-certificate-document="true"
            data-certificate-stage="true"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <h2
                className="font-heading font-semibold text-xl"
                id="certificate-pdf-heading"
              >
                {certificate
                  ? "Certificado de conclusão"
                  : "Status do certificado"}
              </h2>
              <CertificatePublicStatus
                renderStatus={certificate?.renderStatus ?? "ready"}
                status={certificate?.status ?? "revoked"}
              />
            </div>

            {certificate ? (
              <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/30 p-2 sm:p-3">
                {isReady ? (
                  <Image
                    alt="Prévia do certificado"
                    className="h-auto w-full rounded-lg bg-card object-contain outline outline-1 outline-white/10 -outline-offset-1"
                    height={CERTIFICATE_PREVIEW_DIMENSIONS.height}
                    priority
                    src={previewHref}
                    unoptimized
                    width={CERTIFICATE_PREVIEW_DIMENSIONS.width}
                  />
                ) : (
                  <div className="flex min-h-[22rem] items-center justify-center rounded-lg border border-border/70 border-dashed bg-background px-6 text-center">
                    <p className="max-w-sm text-muted-foreground text-sm">
                      {unavailableDocumentMessage}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-[22rem] items-center justify-center rounded-xl border border-destructive/25 bg-destructive/5 px-6 py-10 text-center">
                <div className="max-w-md space-y-3">
                  <h3 className="font-heading font-semibold text-destructive text-lg">
                    Este certificado foi revogado
                  </h3>
                  <p className="text-muted-foreground text-sm leading-6">
                    {formattedRevokedAt
                      ? `A revogação ocorreu em ${formattedRevokedAt}.`
                      : "O certificado foi revogado."}{" "}
                    O documento e os dados associados foram removidos após 60
                    dias. Esta página mantém somente a confirmação do status
                    pelo código.
                  </p>
                </div>
              </div>
            )}

            {certificate && isReady ? (
              <CertificatePublicActions
                code={certificate.code}
                pdfHref={pdfHref}
              />
            ) : null}
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
