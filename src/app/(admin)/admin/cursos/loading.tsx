import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import {
  COURSE_CARD_GRID_CLASS,
  CourseCardLayout,
} from "@/features/courses/course-card-layout";

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer>
      <div className="flex flex-col gap-16">
        <section className={COURSE_CARD_GRID_CLASS}>
          <Skeleton className="min-h-48 rounded-surface border border-dashed" />
          {Array.from({ length: 6 }).map((_, i) => (
            <CourseCardLayout
              actions={<Skeleton className="h-8 w-full" />}
              badge={<Skeleton className="h-5 w-24 rounded-full" />}
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton array
              key={i}
              media={<Skeleton className="absolute inset-0 rounded-none" />}
            >
              <div className="flex min-h-full min-w-0 flex-1 flex-col gap-3">
                <div className="flex min-w-0 flex-col gap-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            </CourseCardLayout>
          ))}
        </section>
      </div>
    </PageContainer>
  );
}
