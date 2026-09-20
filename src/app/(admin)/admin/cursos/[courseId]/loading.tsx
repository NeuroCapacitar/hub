import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <Skeleton className="h-8 w-64" />
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
          <div className="flex flex-col gap-3">
            <Skeleton className="h-7 w-2/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
          <Skeleton className="h-40 rounded-xl" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-1/4" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
