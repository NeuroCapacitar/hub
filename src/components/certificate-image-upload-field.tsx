"use client";

import { Cancel01Icon, ImageUpload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  CERTIFICATE_IMAGE_ACCEPT,
  type CertificateImageKind,
  validateCertificateImageFile,
} from "@/features/certificates/template-image-contract";
import { cn } from "@/lib/utils";

interface CertificateImageUploadFieldProps {
  className?: string;
  compact?: boolean;
  compactWhenImage?: boolean;
  form?: string;
  id?: string;
  imageName?: string | null | undefined;
  imageUrl: string | null;
  kind: CertificateImageKind;
  label?: string;
  onFileSelect: (file: File | null) => void;
  required?: boolean;
  selectedFile?: File | null;
}

export function CertificateImageUploadField({
  className,
  compact = false,
  compactWhenImage = false,
  form,
  id,
  imageUrl,
  imageName,
  kind,
  label = "Arraste ou clique para selecionar a imagem",
  onFileSelect,
  required,
  selectedFile,
}: CertificateImageUploadFieldProps): React.JSX.Element {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = id ?? `certificate-image-upload-${kind}`;

  useEffect(() => {
    const input = inputRef.current;
    if (!(input && typeof DataTransfer !== "undefined")) {
      return;
    }
    const transfer = new DataTransfer();
    if (selectedFile) {
      transfer.items.add(selectedFile);
    }
    input.files = transfer.files;
  }, [selectedFile]);

  const selectFile = (file: File): void => {
    try {
      validateCertificateImageFile(file, kind);
      onFileSelect(file);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível usar a imagem."
      );
    }
  };

  const fileInput = (
    <input
      accept={CERTIFICATE_IMAGE_ACCEPT}
      aria-label={
        kind === "background"
          ? "Selecionar arte de fundo"
          : "Selecionar imagem da assinatura"
      }
      className="sr-only"
      data-upload-kind={kind}
      form={form}
      id={inputId}
      onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) {
          selectFile(file);
        }
      }}
      ref={inputRef}
      required={required && !imageUrl}
      type="file"
    />
  );

  return (
    <div
      className={cn("flex flex-col gap-3", className)}
      data-compact-upload={imageUrl && compactWhenImage ? kind : undefined}
    >
      {imageUrl && compactWhenImage ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 ring-1 ring-foreground/5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-2 shrink-0 rounded-full bg-success" />
            <span className="truncate text-sm">
              {selectedFile?.name ?? imageName ?? "Imagem atual"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="relative rounded-md focus-within:border-focus focus-within:outline-2 focus-within:outline-focus focus-within:outline-offset-2 focus-within:ring-2 focus-within:ring-background">
              {fileInput}
              <label
                className={cn(
                  buttonVariants({ size: "sm", variant: "ghost" }),
                  "min-h-10 cursor-pointer"
                )}
                htmlFor={inputId}
              >
                Substituir imagem
              </label>
            </div>
            <Button
              aria-label="Remover imagem"
              className="min-h-10"
              onClick={() => onFileSelect(null)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Remover
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Drag-and-drop supplements the associated file input. */}
          <label
            className={cn(
              buttonVariants({ size: "default", variant: "outline" }),
              "w-full cursor-pointer flex-col border-dashed text-center transition-[border-color,background-color,scale] focus-within:border-focus focus-within:outline-2 focus-within:outline-focus focus-within:outline-offset-2 focus-within:ring-2 focus-within:ring-background active:scale-[0.96] data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/5",
              compact ? "min-h-16 gap-1.5 py-2" : "min-h-24 gap-2"
            )}
            data-dragging={isDragging}
            htmlFor={inputId}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              const file = event.dataTransfer.files?.[0];
              if (file) {
                selectFile(file);
              }
            }}
          >
            {fileInput}
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={ImageUpload01Icon}
            />
            <span className="text-muted-foreground text-sm">{label}</span>
            <span className="text-xs">
              {kind === "background"
                ? "JPG, PNG ou WebP até 10 MiB"
                : "JPG, PNG ou WebP até 2 MiB"}
            </span>
          </label>
        </>
      )}

      {imageUrl && !compactWhenImage ? (
        <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
          <span className="truncate text-muted-foreground text-sm">
            {selectedFile?.name ?? imageName ?? "Imagem atual"}
          </span>
          <Button
            aria-label="Remover imagem"
            className="min-h-10"
            onClick={() => onFileSelect(null)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={Cancel01Icon}
            />
            Remover
          </Button>
        </div>
      ) : null}
    </div>
  );
}
