"use client";

import { createContext, useContext, useEffect } from "react";
import type { PanelBreadcrumb } from "@/lib/panel-page-titles";

interface PanelPageTitleContextValue {
  readonly setTitle: (
    title: string,
    ancestors?: readonly PanelBreadcrumb[]
  ) => void;
}

export const PanelPageTitleContext =
  createContext<PanelPageTitleContextValue | null>(null);

interface PanelPageTitleProps {
  readonly ancestors?: readonly PanelBreadcrumb[];
  readonly title: string;
}

export function PanelPageTitle({
  ancestors,
  title,
}: PanelPageTitleProps): null {
  const context = useContext(PanelPageTitleContext);

  useEffect(() => {
    context?.setTitle(title, ancestors);
  }, [ancestors, context, title]);

  return null;
}
