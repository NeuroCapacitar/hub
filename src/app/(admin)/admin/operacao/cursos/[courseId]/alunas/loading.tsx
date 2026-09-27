import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer>
      <div aria-busy="true" className="flex flex-col gap-8" role="status">
        <span className="sr-only">Carregando alunos do Curso…</span>
        <div className="grid gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-56" />
        </div>
        <section className="grid gap-4">
          <Skeleton className="h-9 w-full max-w-xl" />
          <div className="overflow-hidden rounded-lg border">
            <Skeleton className="h-10 w-full rounded-none" />
            {["one", "two", "three", "four"].map((key) => (
              <Skeleton className="mt-px h-14 w-full rounded-none" key={key} />
            ))}
          </div>
        </section>
        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <Skeleton className="h-4 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
