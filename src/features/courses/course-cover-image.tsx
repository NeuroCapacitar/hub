"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { COURSE_COVER_HOVER_ZOOM_CLASS } from "./course-cover-motion";

interface CourseCoverImageProps {
  alt: string;
  blurDataUrl: string | null;
  className?: string;
  sizes: string;
  src: string;
  zoomOnHover?: boolean;
}

export function CourseCoverImage({
  alt,
  blurDataUrl,
  className,
  sizes,
  src,
  zoomOnHover = false,
}: CourseCoverImageProps): React.JSX.Element {
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const isLoaded = loadedSource === src;
  const hasError = failedSource === src;

  let placeholderContent: React.JSX.Element;
  if (hasError) {
    placeholderContent = <CourseCoverImageFallback zoomOnHover={zoomOnHover} />;
  } else if (blurDataUrl) {
    placeholderContent = (
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 bg-center bg-cover bg-muted blur-sm",
          zoomOnHover ? COURSE_COVER_HOVER_ZOOM_CLASS : "scale-105"
        )}
        style={{ backgroundImage: `url(${blurDataUrl})` }}
      />
    );
  } else {
    placeholderContent = (
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 bg-muted",
          !isLoaded && "animate-pulse",
          zoomOnHover && COURSE_COVER_HOVER_ZOOM_CLASS
        )}
      />
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-200",
          isLoaded && !hasError ? "opacity-0" : "opacity-100"
        )}
      >
        {placeholderContent}
      </div>
      {hasError ? null : (
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-200",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
        >
          <Image
            alt={alt}
            {...(blurDataUrl ? { blurDataURL: blurDataUrl } : {})}
            className={cn(
              "object-cover",
              zoomOnHover && COURSE_COVER_HOVER_ZOOM_CLASS,
              className
            )}
            fill
            onError={() => {
              setFailedSource(src);
            }}
            onLoad={() => setLoadedSource(src)}
            placeholder={blurDataUrl ? "blur" : "empty"}
            sizes={sizes}
            src={src}
            unoptimized
          />
        </div>
      )}
    </div>
  );
}

export function CourseCoverImageFallback({
  zoomOnHover,
}: {
  zoomOnHover: boolean;
}): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute inset-0 bg-muted",
        zoomOnHover && COURSE_COVER_HOVER_ZOOM_CLASS
      )}
    />
  );
}
