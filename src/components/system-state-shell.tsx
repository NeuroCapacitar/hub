"use client";

import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const systemStateSurfaceClassName =
  "w-full max-w-2xl rounded-2xl border border-border/70 bg-card/90 p-6 shadow-sm sm:p-8";

interface SystemStateShellProps {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly variant?: "embedded" | "full";
}

export function SystemStateShell({
  children,
  className,
  variant = "full",
}: SystemStateShellProps): React.JSX.Element {
  if (variant === "embedded") {
    return (
      <section className={cn("mx-auto w-full max-w-2xl px-6 py-12", className)}>
        <div className={systemStateSurfaceClassName}>{children}</div>
      </section>
    );
  }

  return (
    <main
      className={cn(
        "min-h-screen bg-background px-6 py-10 text-foreground sm:px-10 sm:py-12 lg:px-12",
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-[1344px] flex-col">
        <BrandLogo className="mx-auto mb-8 h-9 w-auto" preload />
        <div className={cn("mx-auto", systemStateSurfaceClassName)}>
          {children}
        </div>
      </div>
    </main>
  );
}

export function SystemStateRetryButton(): React.JSX.Element {
  return (
    <Button onClick={() => window.location.reload()} type="button">
      Tentar novamente
    </Button>
  );
}

interface SystemStateSupportReferenceProps {
  readonly correlationId: string;
  readonly digest?: string;
}

type CopyState = "idle" | "copied" | "error";

const getCopyStatusMessage = (copyState: CopyState): string => {
  if (copyState === "copied") {
    return "Código de suporte copiado.";
  }
  if (copyState === "error") {
    return "Não foi possível copiar o código de suporte.";
  }
  return "";
};

export function SystemStateSupportReference({
  correlationId,
  digest,
}: SystemStateSupportReferenceProps): React.JSX.Element {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const handleCopy = async (): Promise<void> => {
    try {
      if (!navigator.clipboard) {
        throw new Error("clipboard_unavailable");
      }

      await navigator.clipboard.writeText(correlationId);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  };

  return (
    <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-meta text-muted-foreground">Código de suporte</p>
          <p className="type-code mt-1 break-all text-foreground">
            {correlationId}
          </p>
        </div>
        <Button
          className="min-h-11"
          onClick={handleCopy}
          size="sm"
          type="button"
          variant="outline"
        >
          {copyState === "copied" ? "Copiado" : "Copiar código"}
        </Button>
      </div>
      {digest ? (
        <details className="mt-3 text-muted-foreground text-xs">
          <summary className="cursor-pointer underline-offset-4 hover:text-foreground hover:underline">
            Mostrar referência técnica
          </summary>
          <p className="type-code mt-2 break-all">{digest}</p>
        </details>
      ) : null}
      <p aria-live="polite" className="sr-only" role="status">
        {getCopyStatusMessage(copyState)}
      </p>
    </div>
  );
}
