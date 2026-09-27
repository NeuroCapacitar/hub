"use client";

import {
  AlertCircleIcon,
  Cancel01Icon,
  CloudUploadIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type {
  UploadStatusPhase,
  UploadTransferProgress,
} from "@/features/storage/xhr-upload";
import { cn } from "@/lib/utils";

const phaseLabel: Record<UploadStatusPhase, string> = {
  confirming: "Confirmando arquivo…",
  fallback: "Concluindo envio…",
  preparing: "Preparando envio…",
  retrying: "Tentando novamente…",
  saving: "Salvando alterações…",
  uploading: "Enviando arquivo…",
};

export const getUploadStatusLabel = (phase: UploadStatusPhase): string =>
  phaseLabel[phase];

export function UploadProgressStatus({
  errorMessage,
  fileName,
  onCancel,
  onDiscard,
  onRetry,
  phase,
  progress,
  className,
}: {
  errorMessage?: string | null | undefined;
  fileName: string;
  onCancel?: (() => void) | undefined;
  onDiscard?: (() => void) | undefined;
  onRetry?: (() => void) | undefined;
  phase: UploadStatusPhase;
  progress?: UploadTransferProgress | null | undefined;
  className?: string;
}): React.JSX.Element {
  const isError = Boolean(errorMessage);
  const percentage =
    !isError && phase === "uploading" ? (progress?.percentage ?? null) : null;
  let statusIcon = CloudUploadIcon;
  if (isError) {
    statusIcon = AlertCircleIcon;
  } else if (percentage === null) {
    statusIcon = Loading03Icon;
  }
  let actions: React.ReactNode = null;
  if (isError) {
    actions = (
      <div className="flex shrink-0 items-center gap-1">
        {onRetry ? (
          <Button
            aria-label={`Tentar novamente ${fileName}`}
            className="h-8 px-2.5"
            onClick={onRetry}
            size="sm"
            type="button"
            variant="outline"
          >
            Tentar novamente
          </Button>
        ) : null}
        {onDiscard ? (
          <Button
            aria-label={`Descartar envio de ${fileName}`}
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={onDiscard}
            size="icon"
            type="button"
            variant="outline"
          >
            <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} size={14} />
          </Button>
        ) : null}
      </div>
    );
  } else if (onCancel) {
    actions = (
      <Button
        aria-label={`Cancelar envio de ${fileName}`}
        className="h-8 shrink-0 px-2"
        onClick={onCancel}
        size="sm"
        type="button"
        variant="outline"
      >
        <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} size={14} />
        Cancelar
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-3 rounded-lg border bg-background px-3 py-2.5",
        isError && "border-destructive/40 bg-destructive/5",
        className
      )}
    >
      <HugeiconsIcon
        aria-hidden="true"
        className={cn(
          "shrink-0",
          isError ? "text-destructive" : "text-muted-foreground",
          !isError && percentage === null && "animate-spin"
        )}
        icon={statusIcon}
        size={16}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{fileName}</p>
        {isError ? (
          <p className="mt-1 break-words text-destructive text-xs" role="alert">
            {errorMessage}
          </p>
        ) : (
          <>
            <div className="mt-1 flex items-center justify-between gap-3 text-muted-foreground text-xs">
              <span aria-live="polite" role="status">
                {phaseLabel[phase]}
              </span>
              {percentage === null ? null : <span>{percentage}%</span>}
            </div>
            {percentage === null ? null : (
              <Progress
                aria-label={`Progresso do envio de ${fileName}`}
                className="mt-2 h-1.5"
                value={percentage}
              />
            )}
          </>
        )}
      </div>
      {actions}
    </div>
  );
}
