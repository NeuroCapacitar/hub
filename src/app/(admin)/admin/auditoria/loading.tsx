import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

const AUDIT_FILTER_SKELETON_KEYS = [
  "search",
  "source",
  "target",
  "from",
  "to",
  "actions",
] as const;
const AUDIT_ROW_SKELETON_KEYS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
] as const;

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer>
      <div aria-busy="true" className="flex flex-col gap-16" role="status">
        <span className="sr-only">Carregando a auditoria administrativa…</span>
        <section className="grid gap-6">
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-2 h-4 w-full max-w-[460px]" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {AUDIT_FILTER_SKELETON_KEYS.map((key) => (
              <Skeleton className="h-16" key={`audit-filter-${key}`} />
            ))}
          </div>
          <div className="grid gap-4 overflow-x-auto rounded-lg border p-4">
            {AUDIT_ROW_SKELETON_KEYS.map((key) => (
              <Skeleton className="h-12" key={`audit-row-${key}`} />
            ))}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
