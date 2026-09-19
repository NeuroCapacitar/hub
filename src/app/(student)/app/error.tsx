"use client";

import { captureException } from "@sentry/nextjs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  SystemStateShell,
  SystemStateSupportReference,
} from "@/components/system-state-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createCorrelationId } from "@/lib/observability";
import { route } from "@/lib/routes";
import { isSentryRuntimeEnabled } from "@/lib/sentry-deployment";

export default function StudentAreaError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}): React.JSX.Element {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [correlationId] = useState(() => createCorrelationId(null));

  useEffect(() => {
    headingRef.current?.focus();
    if (
      isSentryRuntimeEnabled({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      })
    ) {
      captureException(error, { tags: { correlation_id: correlationId } });
    }
  }, [correlationId, error]);

  return (
    <SystemStateShell variant="embedded">
      <Badge variant="destructive">Área temporariamente indisponível</Badge>
      <h1 className="type-page-title mt-4" ref={headingRef} tabIndex={-1}>
        Não foi possível carregar seus cursos.
      </h1>
      <p className="type-body-sm mt-4 max-w-xl text-muted-foreground">
        Tente novamente. Se o problema continuar, informe o código abaixo ao
        suporte.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={unstable_retry} type="button">
          Tentar novamente
        </Button>
        <Button asChild variant="outline">
          <Link href={route("/app")}>Voltar aos meus cursos</Link>
        </Button>
      </div>
      <div className="mt-6">
        <SystemStateSupportReference
          correlationId={correlationId}
          {...(error.digest ? { digest: error.digest } : {})}
        />
      </div>
    </SystemStateShell>
  );
}
