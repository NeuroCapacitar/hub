"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getSortableDropPlacement } from "./sortable-context";

interface SortableTableRowProps {
  ariaLabel?: string;
  children: React.ReactNode;
  className?: string;
  data?: Record<string, unknown>;
  disabled?: boolean;
  id: string;
}

export function SortableTableRow({
  ariaLabel = "Reordenar item",
  id,
  children,
  className,
  data,
  disabled = false,
}: SortableTableRowProps) {
  const {
    attributes,
    activeIndex,
    index,
    listeners,
    overIndex,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable(data ? { id, data } : { id });

  const dropPlacement = getSortableDropPlacement({
    activeIndex,
    index,
    isDragging,
    isOver,
    overIndex,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging
      ? {
          position: "relative" as const,
          zIndex: 10,
          backgroundColor: "color-mix(in oklch, var(--muted) 50%, transparent)",
        }
      : {}),
  };

  return (
    <TableRow
      className={cn(
        "group/sortable transition-colors",
        isDragging && "opacity-95 drop-shadow-xl",
        dropPlacement === "before" && "border-t-2 border-t-ring",
        dropPlacement === "after" && "border-b-2 border-b-ring",
        className
      )}
      ref={setNodeRef}
      style={style}
    >
      <TableCell className="w-[40px] px-2 py-3 text-center align-middle">
        <button
          aria-label={ariaLabel}
          className="relative flex size-11 cursor-grab items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground/40 outline-none transition-[color,background-color] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing group-hover/sortable:text-muted-foreground sm:size-10"
          {...(disabled ? {} : attributes)}
          {...(disabled ? {} : listeners)}
          disabled={disabled}
          type="button"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={Menu01Icon}
            size={20}
            strokeWidth={2}
          />
        </button>
      </TableCell>
      {children}
    </TableRow>
  );
}
