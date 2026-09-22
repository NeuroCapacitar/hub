import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer>
      <div className="flex flex-col gap-16">
        <section className="grid grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="aspect-[24/25] w-full rounded-xl border border-dashed" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              className="flex aspect-[24/25] w-full flex-col overflow-hidden rounded-xl border bg-card"
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton array
              key={i}
            >
              <Skeleton className="flex-1 rounded-none" />
              <div className="flex shrink-0 flex-col gap-5 p-5 sm:p-6">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </PageContainer>
  );
}
