import { Download01Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { SupportRequestDialog } from "@/components/support-request-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CertificateRecord } from "@/features/certificates/server";
import { formatDate } from "@/lib/formatters";
import { CertificateCardMedia } from "./certificate-card-media";
import { getCertificateLinks } from "./certificate-links";
import { getCertificateListViewModel } from "./certificate-list-view-model";
import { PendingCertificateRefresh } from "./pending-certificate-refresh";

export function CertificateCard({
  certificate,
}: {
  certificate: CertificateRecord;
}): React.JSX.Element {
  const viewModel = getCertificateListViewModel(certificate);
  const titleId = `certificate-${certificate.code}-title`;
  const certificateLinks = getCertificateLinks({
    code: certificate.code,
  });
  return (
    <Card
      aria-labelledby={titleId}
      className="h-full py-0 [--card-spacing:--spacing(4)]"
      role="article"
    >
      <div className="flex h-full min-w-0 flex-col md:flex-row">
        <div className="flex min-h-[14rem] items-center justify-center bg-muted/20 p-3 md:min-h-0 md:w-[34%] xl:w-[42%]">
          <CertificateCardMedia
            kind={viewModel.kind}
            previewHref={certificateLinks.previewHref}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col py-(--card-spacing)">
          <CardHeader className="gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                aria-label={`Status: ${viewModel.statusLabel}`}
                variant={viewModel.badgeVariant}
              >
                {viewModel.statusLabel}
              </Badge>
              <span className="type-meta whitespace-nowrap text-muted-foreground">
                Emitido em {formatDate(certificate.issuedAt)}
              </span>
              <span aria-hidden="true" className="text-muted-foreground/60">
                ·
              </span>
              <span className="type-meta whitespace-nowrap text-muted-foreground">
                {certificate.workloadHours} horas
              </span>
            </div>
            <CardTitle as="h2" className="text-balance" id={titleId}>
              <Link
                href={certificateLinks.publicHref}
                prefetch={false}
                rel="noopener noreferrer"
                target="_blank"
              >
                {certificate.courseTitle}
              </Link>
            </CardTitle>
            <CardDescription
              aria-label={`Código do certificado: ${certificate.code}`}
              className="type-code break-all text-muted-foreground"
            >
              {certificate.code}
            </CardDescription>
          </CardHeader>

          {viewModel.alert ? (
            <CardContent className="mt-4">
              <Alert
                className="rounded-none border-0 bg-transparent px-0 py-0"
                role={viewModel.kind === "preparing" ? "status" : "alert"}
                variant={viewModel.alert.variant}
              >
                <AlertTitle>{viewModel.alert.title}</AlertTitle>
                <AlertDescription>
                  {viewModel.alert.description}
                </AlertDescription>
              </Alert>
            </CardContent>
          ) : null}

          <CardFooter className="mt-auto flex flex-wrap gap-2">
            {viewModel.canDownload ? (
              <Button asChild size="sm">
                <Link
                  aria-label={`Baixar PDF de ${certificate.courseTitle}`}
                  href={certificateLinks.pdfHref}
                  prefetch={false}
                >
                  <HugeiconsIcon
                    aria-hidden="true"
                    data-icon="inline-start"
                    icon={Download01Icon}
                  />
                  Baixar PDF
                </Link>
              </Button>
            ) : null}
            {viewModel.showSupportAction ? (
              <SupportRequestDialog
                courseTitle={certificate.courseTitle}
                triggerLabel="Falar com suporte"
              />
            ) : null}
            {viewModel.kind === "preparing" ? (
              <PendingCertificateRefresh enabled={false} showManualRefresh />
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link
                aria-label={`Visualizar certificado de ${certificate.courseTitle}`}
                href={certificateLinks.publicHref}
                prefetch={false}
                rel="noopener noreferrer"
                target="_blank"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  data-icon="inline-start"
                  icon={ViewIcon}
                />
                Visualizar
              </Link>
            </Button>
          </CardFooter>
        </div>
      </div>
    </Card>
  );
}
