"use client";

import {
  type DndContextProps,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export type SortableDropPlacement = "after" | "before";

export function useSortableSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
}

export function createSortableAccessibility(
  getItemLabel: (id: UniqueIdentifier) => string = (id) => `item ${id}`
): NonNullable<DndContextProps["accessibility"]> {
  const labelFor = (id: UniqueIdentifier): string => getItemLabel(id);

  return {
    announcements: {
      onDragCancel: ({ active }) => `${labelFor(active.id)} não foi movido.`,
      onDragEnd: ({ active, over }) =>
        over
          ? `${labelFor(active.id)} foi movido para ${labelFor(over.id)}.`
          : `${labelFor(active.id)} não foi movido.`,
      onDragOver: ({ active, over }) =>
        over ? `${labelFor(active.id)} sobre ${labelFor(over.id)}.` : undefined,
      onDragStart: ({ active }) =>
        `${labelFor(active.id)} começou a ser movido.`,
    },
    screenReaderInstructions: {
      draggable:
        "Pressione espaço para começar a mover. Use as setas para escolher a posição. Pressione espaço para confirmar ou Escape para cancelar.",
    },
  };
}

export function getSortableDropPlacement({
  activeIndex,
  index,
  isDragging,
  isOver,
  overIndex,
}: {
  activeIndex: number;
  index: number;
  isDragging: boolean;
  isOver: boolean;
  overIndex: number;
}): SortableDropPlacement | null {
  if (
    !isOver ||
    isDragging ||
    activeIndex < 0 ||
    overIndex < 0 ||
    activeIndex === overIndex
  ) {
    return null;
  }

  if (index !== overIndex) {
    return null;
  }

  return activeIndex < overIndex ? "after" : "before";
}
