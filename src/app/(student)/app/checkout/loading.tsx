import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <div aria-busy="true" className="mx-auto w-full max-w-2xl" role="status">
        <span className="sr-only">Carregando confirmação do pagamento…</span>
        <Skeleton className="mx-auto mb-8 h-9 w-28 rounded-md" />

        <section className="rounded-2xl border border-border/70 bg-card/90 p-6 shadow-sm sm:p-8">
          <Skeleton className="h-5 w-44 rounded-full" />
          <Skeleton className="mt-4 h-8 w-72 max-w-full rounded-md" />
          <div className="mt-3 max-w-xl space-y-2">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-4/5 rounded-md" />
          </div>

          <div className="mt-5 flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/45 p-3">
              <Skeleton className="size-12 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-12 rounded-md" />
                <Skeleton className="h-4 w-48 max-w-full rounded-md" />
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
              <Skeleton className="h-4 w-64 max-w-full rounded-md" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Skeleton className="h-9 w-32 rounded-md" />
                <Skeleton className="h-9 w-28 rounded-md" />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Skeleton className="h-9 w-36 rounded-md" />
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
