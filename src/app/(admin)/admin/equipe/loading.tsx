import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer>
      <div aria-busy="true" className="flex flex-col gap-16" role="status">
        <span className="sr-only">Carregando a Equipe…</span>
        <section className="grid gap-6">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-full max-w-[620px]" />
            <Skeleton className="h-4 w-full max-w-[540px]" />
            <div className="flex flex-wrap justify-end gap-2 sm:col-start-2 sm:row-span-3 sm:row-start-1">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-40" />
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[minmax(260px,1.5fr)_140px_minmax(260px,1fr)_180px_150px] gap-3 border-b p-4">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="ml-auto h-5 w-16" />
              </div>
              <div className="grid gap-4 p-4">
                {["one", "two", "three", "four"].map((key) => (
                  <div
                    className="grid grid-cols-[minmax(260px,1.5fr)_140px_minmax(260px,1fr)_180px_150px] items-center gap-3"
                    key={key}
                  >
                    <div className="grid gap-2">
                      <Skeleton className="h-5 w-44" />
                      <Skeleton className="h-4 w-52" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-4 w-52" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="ml-auto h-10 w-32 rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
