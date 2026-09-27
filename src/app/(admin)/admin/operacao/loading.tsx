import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

const OPERATIONS_SECTION_SKELETON_KEYS = [
  "alerts",
  "jmvstream",
  "webhooks",
  "outbox",
  "signals",
] as const;
const REMAINING_OPERATIONS_SECTION_SKELETON_KEYS =
  OPERATIONS_SECTION_SKELETON_KEYS.slice(1);

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer>
      <div aria-busy="true" className="flex flex-col gap-16" role="status">
        <span className="sr-only">Carregando operações e recuperação…</span>
        <div className="flex flex-col gap-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[360px] rounded-xl" />
        </div>
        {REMAINING_OPERATIONS_SECTION_SKELETON_KEYS.map((key) => (
          <Skeleton
            className="h-[360px] rounded-xl"
            key={`operations-section-${key}`}
          />
        ))}
      </div>
    </PageContainer>
  );
}
