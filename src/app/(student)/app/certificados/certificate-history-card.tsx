import { Alert02Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CertificateRecord } from "@/features/certificates/server";
import { formatDate } from "@/lib/formatters";
import { getCertificateLinks } from "./certificate-links";
import { getCertificateListViewModel } from "./certificate-list-view-model";

export function CertificateHistoryCard({
  certificate,
}: {
  certificate: CertificateRecord;
}): React.JSX.Element {
  const viewModel = getCertificateListViewModel(certificate);
  const titleId = `certificate-history-${certificate.code}-title`;
  const certificateLinks = getCertificateLinks({ code: certificate.code });

  return (
    <Card
      aria-labelledby={titleId}
      className="gap-0 py-0 [--card-spacing:--spacing(4)]"
      role="article"
    >
      <CardHeader className="gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="type-meta whitespace-nowrap text-muted-foreground">
                Emitido em {formatDate(certificate.issuedAt)}
              </span>
            </div>
            <CardTitle as="h3" className="mt-1.5 text-balance" id={titleId}>
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
          </div>

          <Button asChild className="shrink-0" size="sm" variant="outline">
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
        </div>
      </CardHeader>

      <CardContent className="border-destructive/25 border-t bg-destructive/5 p-4">
        <div
          aria-label="Aviso de certificado revogado"
          className="flex items-start gap-2 text-destructive"
          role="alert"
        >
          <HugeiconsIcon
            aria-hidden="true"
            className="mt-0.5 shrink-0"
            icon={Alert02Icon}
            size={16}
            strokeWidth={1.8}
          />
          <p className="text-sm leading-5">{viewModel.alert?.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
