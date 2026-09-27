import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

const COURSE_MODULE_SKELETON_KEYS = [
  "module-one",
  "module-two",
  "module-three",
];
const COURSE_LESSON_SKELETON_KEYS = ["lesson-one", "lesson-two"];

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <div aria-busy="true" className="flex flex-col gap-8" role="status">
        <span className="sr-only">Carregando detalhes do Curso…</span>
        <header className="border-b pb-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-8 w-3/5 max-w-lg" />
              <div className="grid max-w-2xl gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row">
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="h-9 w-36 rounded-md" />
              <div className="grid min-w-[200px] gap-2 rounded-md border bg-card px-3 py-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
              <Skeleton className="h-9 w-36 rounded-md" />
            </div>
          </div>
        </header>

        <section className="pt-9">
          <div className="mb-10 grid gap-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex flex-col">
            {COURSE_MODULE_SKELETON_KEYS.map((moduleKey, moduleIndex) => (
              <section className="flex flex-col" key={moduleKey}>
                <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div className="grid gap-2">
                    <Skeleton className="h-6 w-52" />
                    <Skeleton className="h-4 w-full max-w-xl" />
                  </div>
                  <div className="grid shrink-0 justify-items-start gap-2 md:justify-items-end">
                    <Skeleton className="h-4 w-28" />
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-2 w-24 rounded-full" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                  </div>
                </div>
                <div className="custom-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-hidden pt-2 pb-4">
                  {COURSE_LESSON_SKELETON_KEYS.map((lessonKey) => (
                    <div
                      className="flex w-[280px] shrink-0 flex-col gap-3"
                      key={`${moduleKey}-${lessonKey}`}
                    >
                      <Skeleton className="aspect-video w-full rounded-media" />
                      <div className="grid gap-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
                {moduleIndex < COURSE_MODULE_SKELETON_KEYS.length - 1 ? (
                  <hr className="my-8 border-border border-dashed" />
                ) : null}
              </section>
            ))}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
