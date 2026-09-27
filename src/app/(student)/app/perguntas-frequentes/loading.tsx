import { PageContainer } from "@/components/page-container";
import { Frame, FramePanel, FrameTitle } from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

const FAQ_SKELETON_ITEMS = [
  "faq-skeleton-1",
  "faq-skeleton-2",
  "faq-skeleton-3",
  "faq-skeleton-4",
] as const;

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer className="bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <Skeleton className="h-8 w-56 rounded-md" />
        <section className="flex flex-col gap-4">
          {FAQ_SKELETON_ITEMS.map((item) => (
            <Frame
              className="bg-muted/25 [--frame-radius:var(--radius-surface)]"
              key={item}
              spacing="sm"
              variant="ghost"
            >
              <FrameTitle className="px-2 py-1">
                <Skeleton className="h-5 w-3/4 rounded-md" />
              </FrameTitle>
              <FramePanel className="border-border/70 bg-card p-0 shadow-none">
                <div className="flex flex-col gap-4 px-5 py-5 sm:px-6 sm:py-6">
                  <Skeleton className="h-4 w-full rounded-md" />
                  <Skeleton className="h-4 w-2/3 rounded-md" />
                </div>
              </FramePanel>
            </Frame>
          ))}
        </section>
      </div>
    </PageContainer>
  );
}
