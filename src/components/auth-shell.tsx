import Image from "next/image";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { PLATFORM_LOGIN_IMAGE_SRC } from "@/lib/brand";

export function AuthShell({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <main className="min-h-screen bg-background px-4 py-4 text-foreground sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-hidden rounded-3xl border border-border/60 bg-card/40 shadow-sm sm:min-h-[calc(100dvh-3rem)] lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,1fr)_440px]">
        <section className="relative hidden min-h-[min(34rem,calc(100dvh-2rem))] overflow-hidden bg-muted lg:block">
          <Image
            alt=""
            className="object-cover"
            fill
            priority
            sizes="(min-width: 1024px) calc(100vw - 440px), 100vw"
            src={PLATFORM_LOGIN_IMAGE_SRC}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-background/10"
          />
        </section>
        <section className="flex min-h-[min(34rem,calc(100dvh-2rem))] items-center bg-background px-6 py-10 text-foreground sm:px-10">
          <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
            <BrandLogo
              className="h-10 w-auto max-w-full object-contain object-left"
              preload
            />
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
