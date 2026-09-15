import type { ReactNode } from "react";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { AuthMediaSlot } from "@/features/auth-media/auth-media-slot";
import { cn } from "@/lib/utils";

interface AuthShellProps {
  children: ReactNode;
  formSide?: "left" | "right";
}

export function AuthShell({
  children,
  formSide = "right",
}: AuthShellProps): React.JSX.Element {
  const contentOrder = formSide === "right" ? "lg:order-2" : "lg:order-1";
  const mediaOrder = formSide === "right" ? "lg:order-1" : "lg:order-2";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="auth-shell-frame grid grid-cols-1 overflow-hidden shadow-none lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <section
          className={cn(
            "flex min-h-[36rem] items-center justify-center px-6 py-12 sm:px-10 lg:min-h-0 lg:px-16 xl:px-20",
            contentOrder
          )}
        >
          <div className="mx-auto flex w-full max-w-[30rem] flex-col gap-8">
            <BrandLogo
              className="h-9 w-auto max-w-full self-center object-contain"
              preload
            />
            {children}
          </div>
        </section>
        <section
          className={cn(
            "relative hidden min-h-[36rem] items-stretch overflow-hidden p-3 lg:flex lg:min-h-0",
            mediaOrder
          )}
        >
          <Suspense
            fallback={
              <div
                aria-hidden="true"
                className="absolute inset-3 rounded-xl bg-muted/40"
              />
            }
          >
            <AuthMediaSlot />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
