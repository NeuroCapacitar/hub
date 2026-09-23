import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const COURSE_CARD_GRID_CLASS =
  "grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3";

const INTERACTIVE_CARD_CLASS = [
  "transition-[border-color] duration-300 ease-in-out",
  "hover:border-primary/45 focus-within:border-primary/45",
  "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:bg-primary/5",
  "before:opacity-0 before:transition-opacity before:duration-300 before:ease-in-out before:content-['']",
  "hover:before:opacity-100 focus-within:before:opacity-100",
].join(" ");

interface CourseCardLayoutProps {
  actions?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  interactive?: boolean;
  media: ReactNode;
  overlay?: ReactNode;
}

export function CourseCardLayout({
  actions,
  badge,
  children,
  contentClassName,
  interactive = false,
  media,
  overlay,
}: CourseCardLayoutProps): React.JSX.Element {
  return (
    <div className="@container/course-card h-full min-w-0">
      <article
        className={cn(
          "group relative isolate flex h-full min-w-0 flex-col rounded-surface border border-border/70 bg-card text-card-foreground shadow-sm",
          interactive && INTERACTIVE_CARD_CLASS
        )}
      >
        <div className="min-w-0 p-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-media bg-muted">
            {media}
            {badge ? (
              <div className="pointer-events-none absolute top-2 left-2 z-20">
                {badge}
              </div>
            ) : null}
          </div>
        </div>

        {overlay}

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col px-3 pt-3 pb-0",
            contentClassName
          )}
        >
          {children}
        </div>

        {actions ? (
          <div className="mt-auto min-w-0 px-3 pt-3 pb-3">{actions}</div>
        ) : null}
      </article>
    </div>
  );
}
