import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentAreaLoading(): React.JSX.Element {
  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <div className="flex flex-col gap-8">
        <div className="pt-4 md:hidden">
          <Skeleton className="h-8 w-56 max-w-full rounded-md" />
        </div>
        <div className="flex flex-col gap-12">
          <section>
            <div className="mb-5">
              <Skeleton className="h-6 w-48" />
            </div>
            <div className="grid overflow-hidden rounded-surface border border-border/70 bg-card lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
              <Skeleton className="aspect-[16/10] rounded-none lg:aspect-auto lg:min-h-52" />
              <div className="flex flex-col gap-5 p-5 sm:p-6 lg:p-8">
                <Skeleton className="h-5 w-28 rounded-full" />
                <div className="space-y-3">
                  <Skeleton className="h-6 w-56 max-w-full rounded-md" />
                  <Skeleton className="h-4 w-72 max-w-full rounded-md" />
                  <Skeleton className="h-4 w-40 max-w-full rounded-md" />
                </div>
                <div className="mt-auto space-y-4">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-full rounded-md" />
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Skeleton className="h-9 w-36 rounded-md" />
                    <Skeleton className="h-8 w-28 rounded-md" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
