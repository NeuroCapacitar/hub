import type { ReactNode } from "react";
import { PanelPageTitle } from "@/components/panel-page-title";
import type { PanelBreadcrumb } from "@/lib/panel-page-titles";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  readonly actions?: ReactNode;
  readonly breadcrumbs?: readonly PanelBreadcrumb[];
  readonly children?: ReactNode;
  readonly className?: string;
  readonly description?: ReactNode;
  readonly status?: ReactNode;
  readonly title: string;
  readonly visibleHeading?: boolean;
}

export function PageHeader({
  actions,
  breadcrumbs,
  children,
  className,
  description,
  status,
  title,
  visibleHeading = true,
}: PageHeaderProps): React.JSX.Element {
  const hasToolbarContent = Boolean(actions || children || status);
  const hasTitleRow = visibleHeading || status;
  const hasHeaderContent =
    hasTitleRow || Boolean(description) || hasToolbarContent;

  return (
    <>
      <PanelPageTitle
        {...(breadcrumbs ? { ancestors: breadcrumbs } : {})}
        title={title}
        visibleHeading={visibleHeading}
      />
      {hasHeaderContent ? (
        <header className={cn("flex flex-col gap-3", className)}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              {hasTitleRow ? (
                <div className="flex flex-wrap items-center gap-3">
                  {visibleHeading ? (
                    <h1 className="type-page-title text-balance">{title}</h1>
                  ) : null}
                  {status}
                </div>
              ) : null}
              {description ? (
                <p className="mt-1 max-w-3xl text-pretty text-muted-foreground text-sm">
                  {description}
                </p>
              ) : null}
              {children}
            </div>
            {actions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                {actions}
              </div>
            ) : null}
          </div>
        </header>
      ) : null}
    </>
  );
}
