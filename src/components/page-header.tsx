import type { ReactNode } from "react";
import { PanelPageTitle } from "@/components/panel-page-title";
import type { PanelBreadcrumb } from "@/lib/panel-page-titles";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  readonly actions?: ReactNode;
  readonly breadcrumbs?: readonly PanelBreadcrumb[];
  readonly children?: ReactNode;
  readonly className?: string;
  readonly status?: ReactNode;
  readonly title: string;
}

export function PageHeader({
  actions,
  breadcrumbs,
  children,
  className,
  status,
  title,
}: PageHeaderProps): React.JSX.Element {
  const hasToolbarContent = Boolean(actions || children || status);

  return (
    <>
      <PanelPageTitle
        {...(breadcrumbs ? { ancestors: breadcrumbs } : {})}
        title={title}
      />
      {hasToolbarContent ? (
        <header className={cn("flex flex-col gap-3 border-b pb-4", className)}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">{status}</div>
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
