"use client";

import Link from "next/link";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PanelBreadcrumb as PanelBreadcrumbItem } from "@/lib/panel-page-titles";
import { route } from "@/lib/routes";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_ITEMS = 3;

interface PanelBreadcrumbProps {
  readonly ancestors: readonly PanelBreadcrumbItem[];
  readonly currentTitle?: string;
}

type VisibleItem =
  | {
      readonly isCurrent: boolean;
      readonly item: PanelBreadcrumbItem;
      readonly type: "item";
    }
  | {
      readonly hidden: readonly PanelBreadcrumbItem[];
      readonly type: "ellipsis";
    };

function collapseBreadcrumbs(
  ancestors: readonly PanelBreadcrumbItem[],
  currentTitle?: string
): readonly VisibleItem[] {
  const items = ancestors.map((item) => ({ item, isCurrent: false }));

  if (currentTitle !== undefined) {
    items.push({ item: { label: currentTitle }, isCurrent: true });
  }

  if (items.length <= MAX_VISIBLE_ITEMS) {
    return items.map(({ isCurrent, item }) => ({
      isCurrent,
      item,
      type: "item" as const,
    }));
  }

  const first = items[0];
  const penultimate = items.at(-2);
  const last = items.at(-1);

  if (!(first && penultimate && last)) {
    return [];
  }

  return [
    { isCurrent: first.isCurrent, item: first.item, type: "item" },
    {
      hidden: items.slice(1, -2).map(({ item }) => item),
      type: "ellipsis",
    },
    { isCurrent: penultimate.isCurrent, item: penultimate.item, type: "item" },
    { isCurrent: last.isCurrent, item: last.item, type: "item" },
  ];
}

function BreadcrumbItemContent({
  item,
  isCurrent,
}: {
  readonly isCurrent: boolean;
  readonly item: PanelBreadcrumbItem;
}): React.JSX.Element {
  const className = cn(
    "block min-w-0 truncate",
    isCurrent
      ? "font-semibold text-foreground"
      : "text-muted-foreground hover:text-foreground"
  );

  if (isCurrent) {
    return (
      <BreadcrumbPage
        aria-label={item.label}
        className={className}
        title={item.label}
      >
        {item.label}
      </BreadcrumbPage>
    );
  }

  if (!item.href) {
    return (
      <span className={className} title={item.label}>
        {item.label}
      </span>
    );
  }

  return (
    <BreadcrumbLink asChild className={className} title={item.label}>
      <Link href={route(item.href)}>{item.label}</Link>
    </BreadcrumbLink>
  );
}

function CollapsedBreadcrumb({
  hidden,
}: {
  readonly hidden: readonly PanelBreadcrumbItem[];
}): React.JSX.Element {
  return (
    <BreadcrumbItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Mostrar níveis ocultos do caminho"
            className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
          >
            <BreadcrumbEllipsis />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-[min(80vw,20rem)]">
          <DropdownMenuLabel>Caminho da página</DropdownMenuLabel>
          {hidden.map((item) =>
            item.href ? (
              <DropdownMenuItem asChild key={`${item.href}:${item.label}`}>
                <Link className="min-w-0 truncate" href={route(item.href)}>
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled key={item.label}>
                {item.label}
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </BreadcrumbItem>
  );
}

export function PanelBreadcrumb({
  ancestors,
  currentTitle,
}: PanelBreadcrumbProps): React.JSX.Element | null {
  const items = collapseBreadcrumbs(ancestors, currentTitle);

  if (items.length === 0) {
    return null;
  }

  return (
    <Breadcrumb aria-label="Caminho da página" className="min-w-0 flex-1">
      <BreadcrumbList className="min-w-0 flex-nowrap gap-1 overflow-hidden text-sm sm:gap-1.5">
        {items.map((entry, index) => (
          <Fragment
            key={
              entry.type === "ellipsis"
                ? `ellipsis-${entry.hidden.map((item) => item.label).join("/")}`
                : `${entry.item.href ?? "current"}:${entry.item.label}`
            }
          >
            {index > 0 ? (
              <BreadcrumbSeparator className="shrink-0 text-muted-foreground/60">
                /
              </BreadcrumbSeparator>
            ) : null}
            {entry.type === "ellipsis" ? (
              <CollapsedBreadcrumb hidden={entry.hidden} />
            ) : (
              <BreadcrumbItem
                className={cn(
                  "min-w-0 shrink",
                  entry.isCurrent
                    ? "max-w-[min(55vw,24rem)] flex-1"
                    : "max-w-[9rem] sm:max-w-[13rem]"
                )}
              >
                <BreadcrumbItemContent
                  isCurrent={entry.isCurrent}
                  item={entry.item}
                />
              </BreadcrumbItem>
            )}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
