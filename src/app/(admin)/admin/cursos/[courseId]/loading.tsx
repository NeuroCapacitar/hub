import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-9 w-36" />
        </div>

        <div className="max-w-full overflow-x-auto border-b">
          <div className="flex min-w-max gap-1 py-1">
            {["overview", "content", "students", "settings", "certificate"].map(
              (tab) => (
                <Skeleton className="h-9 w-28" key={`course-tab-${tab}`} />
              )
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <Skeleton className="h-28 rounded-xl" />
          <section className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </section>
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    </PageContainer>
  );
}
