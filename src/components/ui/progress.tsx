"use client";

import { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Progress({
  className,
  tone = "active",
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  tone?: "active" | "complete";
}) {
  return (
    <ProgressPrimitive.Root
      className={cn(
        "relative flex h-3 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      data-slot="progress"
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "size-full flex-1 transition-[width,transform]",
          tone === "complete" ? "bg-progress-complete" : "bg-progress-active"
        )}
        data-slot="progress-indicator"
        data-tone={tone}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
