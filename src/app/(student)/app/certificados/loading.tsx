import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <div className="flex flex-col gap-8">
        <div className="flex items-start gap-4">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="grid gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
        </div>
        <section className="grid gap-4">
          <Skeleton className="h-[220px] w-full rounded-xl" />
          <Skeleton className="h-[220px] w-full rounded-xl" />
        </section>
      </div>
    </PageContainer>
  );
}
