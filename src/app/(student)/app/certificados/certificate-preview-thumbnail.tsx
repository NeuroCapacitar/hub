"use client";

import { Certificate01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import { useState } from "react";

export function CertificatePreviewThumbnail({
  previewHref,
}: {
  previewHref: string;
}): React.JSX.Element {
  const [hasError, setHasError] = useState(false);

  return (
    <div
      aria-hidden="true"
      className="relative mx-auto aspect-[1.414/1] w-full max-w-[20rem] overflow-hidden rounded-md bg-surface-warm p-1.5 shadow-lg ring-1 ring-black/10"
      data-certificate-preview="true"
    >
      {hasError ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 rounded-sm bg-muted/50 px-4 text-center text-muted-foreground">
          <HugeiconsIcon
            aria-hidden="true"
            icon={Certificate01Icon}
            size={32}
            strokeWidth={1.4}
          />
          <span className="text-xs">Prévia indisponível</span>
        </div>
      ) : (
        <Image
          alt=""
          className="rounded-sm object-contain"
          fill
          loading="lazy"
          onError={() => setHasError(true)}
          sizes="(min-width: 1280px) 15rem, (min-width: 768px) 20rem, calc(100vw - 3rem)"
          src={previewHref}
          unoptimized
        />
      )}
    </div>
  );
}
