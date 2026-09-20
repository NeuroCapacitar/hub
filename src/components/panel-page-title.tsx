"use client";

import { createContext, useContext, useEffect } from "react";
import type { PanelBreadcrumb } from "@/lib/panel-page-titles";

interface PanelPageTitleContextValue {
  readonly setTitle: (
    title: string,
    ancestors?: readonly PanelBreadcrumb[]
  ) => void;
  readonly setVisibleHeading: (visible: boolean) => void;
}

export const PanelPageTitleContext =
  createContext<PanelPageTitleContextValue | null>(null);

interface PanelPageTitleProps {
  readonly ancestors?: readonly PanelBreadcrumb[];
  readonly title: string;
  readonly visibleHeading?: boolean;
}

export function PanelPageTitle({
  ancestors,
  title,
  visibleHeading = false,
}: PanelPageTitleProps): null {
  const context = useContext(PanelPageTitleContext);

  useEffect(() => {
    context?.setTitle(title, ancestors);
    context?.setVisibleHeading(visibleHeading);

    return () => {
      if (visibleHeading) {
        context?.setVisibleHeading(false);
      }
    };
  }, [ancestors, context, title, visibleHeading]);

  return null;
}
