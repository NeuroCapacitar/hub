import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-12 pt-4">
          <section className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row">
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-32 rounded-md" />
              <Skeleton className="h-8 w-48 rounded-md" />
              <Skeleton className="h-8 w-32 rounded-md" />
            </div>
          </section>

          <section className="space-y-4">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
