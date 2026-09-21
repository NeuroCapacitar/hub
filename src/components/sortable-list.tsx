"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getSortableDropPlacement,
  type SortableDropPlacement,
} from "./sortable-context";

interface SortableItemProps {
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
  data?: Record<string, unknown>;
  disabled?: boolean;
  dropPlacementOverride?: SortableDropPlacement | "inside" | null;
  handleAlignment?: "center" | "start";
  handleClassName?: string;
  handleHidden?: boolean;
  id: string;
}

export function SortableItem({
  ariaLabel,
  id,
  children,
  className,
  handleClassName,
  handleAlignment = "center",
  data,
  disabled = false,
  dropPlacementOverride = null,
  handleHidden = false,
}: SortableItemProps) {
  const {
    attributes,
    active,
    activeIndex,
    index,
    listeners,
    overIndex,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable(data ? { data, disabled, id } : { disabled, id });

  const calculatedDropPlacement = getSortableDropPlacement({
    activeIndex,
    index,
    isDragging,
    isOver,
    overIndex,
  });
  const dropPlacement =
    dropPlacementOverride === "inside"
      ? null
      : (dropPlacementOverride ?? calculatedDropPlacement);
  const isLessonEnteringModule =
    (dropPlacementOverride === "inside" || isOver) &&
    !isDragging &&
    data?.type === "module" &&
    active?.data.current?.type === "lesson";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { position: "relative" as const, zIndex: 10 } : {}),
  };

  return (
    <div
      className={cn(
        "group/sortable relative flex items-stretch transition-colors",
        isDragging && "opacity-95 drop-shadow-xl",
        isLessonEnteringModule && "ring-2 ring-primary/50",
        className
      )}
      ref={setNodeRef}
      style={style}
    >
      {dropPlacement === "before" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 top-0 z-20 h-0.5 rounded-full bg-ring"
        />
      ) : null}
      {handleHidden ? null : (
        <Button
          aria-label={ariaLabel}
          className={cn(
            "size-11 touch-manipulation text-muted-foreground/50 hover:text-foreground active:cursor-grabbing md:size-10",
            handleAlignment === "start" ? "mt-4 self-start" : "self-center",
            !disabled && "cursor-grab",
            handleClassName
          )}
          disabled={disabled}
          size="icon"
          type="button"
          variant="ghost"
          {...attributes}
          {...listeners}
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={Menu01Icon}
            size={20}
            strokeWidth={2}
          />
        </Button>
      )}
      {dropPlacement === "after" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 bottom-0 z-20 h-0.5 rounded-full bg-ring"
        />
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
