"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type React from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  reorderLessonsAction,
  reorderModulesAction,
} from "@/features/admin/actions";
import type {
  AdminCourse,
  AdminLesson,
  AdminModule,
} from "@/features/admin/server";
import { getAffectedLessonReorderGroups } from "./course-builder-reorder";
import {
  createSortableAccessibility,
  getSortableDropPlacement,
  type SortableDropPlacement,
  useSortableSensors,
} from "./sortable-context";
import { SortableItem } from "./sortable-list";

type CourseData = AdminCourse;
type ModuleData = AdminModule;
type LessonData = AdminLesson;

export interface CourseBuilderModuleRenderState {
  contentId: string;
  expanded: boolean;
  onToggle: () => void;
}

interface CourseBuilderClientProps {
  course: CourseData;
  editable: boolean;
  initialLessons: LessonData[];
  initialModules: ModuleData[];
  renderLesson: (
    lesson: LessonData,
    moduleData: ModuleData,
    index: number
  ) => React.ReactNode;
  renderModule: (
    moduleData: ModuleData,
    moduleLessons: LessonData[],
    index: number,
    disclosure: CourseBuilderModuleRenderState
  ) => React.ReactNode;
  toolbar?: React.ReactNode;
}

interface CourseBuilderDropPreview {
  id: string;
  placement: "after" | "before" | "inside";
  type: "lesson" | "module";
}

const getLessonDropPlacement = (
  preview: CourseBuilderDropPreview | null,
  lessonId: string
): SortableDropPlacement | null => {
  if (!(preview?.type === "lesson" && preview.id === lessonId)) {
    return null;
  }
  return preview.placement === "inside" ? null : preview.placement;
};

function SortableLesson({
  children,
  disabled,
  handleHidden,
  lesson,
  dropPlacementOverride = null,
}: {
  children: React.ReactNode;
  disabled: boolean;
  dropPlacementOverride?: SortableDropPlacement | null;
  handleHidden: boolean;
  lesson: LessonData;
}): React.JSX.Element {
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
  } = useSortable({
    data: { type: "lesson" },
    disabled,
    id: lesson.id,
  });
  const calculatedDropPlacement = getSortableDropPlacement({
    activeIndex,
    index,
    isDragging,
    isOver,
    overIndex,
  });
  const dropPlacement = dropPlacementOverride ?? calculatedDropPlacement;

  return (
    <div
      className={`relative flex min-w-0 border-t transition-colors ${
        isDragging ? "z-10 bg-card opacity-95 drop-shadow-xl" : ""
      }`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {dropPlacement === "before" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 top-0 z-20 h-0.5 rounded-full bg-ring"
        />
      ) : null}
      {handleHidden ? null : (
        <Button
          aria-label={`Reordenar aula ${lesson.title}`}
          className="ml-1 size-11 touch-manipulation self-center text-muted-foreground/50 hover:text-foreground active:cursor-grabbing md:size-10"
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
            size={18}
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

export function CourseBuilderClient({
  course,
  editable,
  initialModules,
  initialLessons,
  renderModule,
  renderLesson,
  toolbar,
}: CourseBuilderClientProps) {
  const [modules, setModules] = useState(initialModules);
  const [lessons, setLessons] = useState(initialLessons);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"module" | "lesson" | null>(
    null
  );
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [activeWidth, setActiveWidth] = useState<number | null>(null);
  const [dropPreview, setDropPreview] =
    useState<CourseBuilderDropPreview | null>(null);
  const dragOverRef = useRef<CourseBuilderDropPreview | null>(null);
  const dragSnapshotRef = useRef<{
    expandedModuleIds: Set<string>;
    lessons: LessonData[];
    modules: ModuleData[];
  } | null>(null);
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(
    () => new Set(initialModules[0] ? [initialModules[0].id] : [])
  );
  const hasInitializedModuleExpansion = useRef(initialModules.length > 0);
  const [isPending, startTransition] = useTransition();
  const areAllModulesExpanded =
    modules.length > 0 &&
    modules.every((moduleData) => expandedModuleIds.has(moduleData.id));

  useEffect(() => {
    setModules(initialModules);
  }, [initialModules]);

  useEffect(() => {
    setLessons(initialLessons);
  }, [initialLessons]);

  useEffect(() => {
    const availableModuleIds = new Set(initialModules.map((item) => item.id));
    const firstModule = initialModules[0];
    const wasExpansionInitialized = hasInitializedModuleExpansion.current;
    setExpandedModuleIds((current) => {
      const next = new Set(
        [...current].filter((moduleId) => availableModuleIds.has(moduleId))
      );
      const shouldOpenFirstModule =
        firstModule &&
        next.size === 0 &&
        (!wasExpansionInitialized || current.size > 0);
      if (shouldOpenFirstModule) {
        next.add(firstModule.id);
      }
      return next;
    });
    if (initialModules.length > 0) {
      hasInitializedModuleExpansion.current = true;
    }
  }, [initialModules]);

  const sensors = useSortableSensors();
  const accessibility = createSortableAccessibility((id) => {
    const moduleData = modules.find((item) => item.id === id);
    if (moduleData) {
      return `Módulo ${moduleData.title}`;
    }
    const lesson = lessons.find((item) => item.id === id);
    return lesson ? `Aula ${lesson.title}` : `item ${id}`;
  });

  function handleDragStart(event: DragStartEvent) {
    if (!editable || isPending) {
      return;
    }

    const { active } = event;
    const type = active.data.current?.type;
    dragOverRef.current = null;
    setDropPreview(null);
    dragSnapshotRef.current = {
      expandedModuleIds: new Set(expandedModuleIds),
      lessons,
      modules,
    };
    setActiveId(active.id as string);
    setActiveType(type as "module" | "lesson");
    setActiveWidth(active.rect?.current?.initial?.width ?? null);
    setActiveLabel(
      type === "module"
        ? (modules.find((item) => item.id === active.id)?.title ?? null)
        : (lessons.find((item) => item.id === active.id)?.title ?? null)
    );
  }

  function handleDragOver(event: DragOverEvent) {
    if (!editable || isPending) {
      return;
    }

    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) {
      dragOverRef.current = null;
      setDropPreview(null);
      return;
    }

    if (active.data.current?.type !== "lesson") {
      return;
    }

    if (dragOverRef.current?.id === overId) {
      return;
    }

    if (over.data.current?.type === "lesson") {
      handleLessonDragOver(activeId, overId);
    } else if (over.data.current?.type === "module") {
      handleModuleDragOver(activeId, overId);
    }
  }

  function handleLessonDragOver(activeId: string, overId: string) {
    const activeIndex = lessons.findIndex((lesson) => lesson.id === activeId);
    const overIndex = lessons.findIndex((lesson) => lesson.id === overId);
    if (activeIndex === -1 || overIndex === -1) {
      return;
    }

    const preview: CourseBuilderDropPreview = {
      id: overId,
      placement: activeIndex < overIndex ? "after" : "before",
      type: "lesson",
    };
    dragOverRef.current = preview;
    setDropPreview(preview);
    const destinationLesson = lessons.find((lesson) => lesson.id === overId);
    if (destinationLesson) {
      setExpandedModuleIds((current) =>
        new Set(current).add(destinationLesson.moduleId)
      );
    }
    setLessons((prev) => {
      const currentActiveIndex = prev.findIndex((l) => l.id === activeId);
      const currentOverIndex = prev.findIndex((l) => l.id === overId);
      if (currentActiveIndex === -1 || currentOverIndex === -1) {
        return prev;
      }

      const activeLesson = prev[currentActiveIndex];
      const overLesson = prev[currentOverIndex];

      if (!(activeLesson && overLesson)) {
        return prev;
      }

      if (activeLesson.moduleId !== overLesson.moduleId) {
        const updatedLessons = [...prev];
        updatedLessons[currentActiveIndex] = {
          ...activeLesson,
          moduleId: overLesson.moduleId,
        } as LessonData;
        return arrayMove(updatedLessons, currentActiveIndex, currentOverIndex);
      }

      return arrayMove(prev, currentActiveIndex, currentOverIndex);
    });
  }

  function handleModuleDragOver(activeId: string, overId: string) {
    const preview: CourseBuilderDropPreview = {
      id: overId,
      placement: "inside",
      type: "module",
    };
    dragOverRef.current = preview;
    setDropPreview(preview);
    setExpandedModuleIds((current) => new Set(current).add(overId));
    setLessons((prev) => {
      const activeIndex = prev.findIndex((l) => l.id === activeId);
      if (activeIndex === -1) {
        return prev;
      }

      const activeLesson = prev[activeIndex];

      if (!activeLesson || activeLesson.moduleId === overId) {
        return prev;
      }

      const updatedLessons = [...prev];
      updatedLessons[activeIndex] = {
        ...activeLesson,
        moduleId: overId,
      } as LessonData;
      return arrayMove(updatedLessons, activeIndex, updatedLessons.length - 1);
    });
  }

  function handleModuleDragEnd(
    activeId: string | number,
    overId: string | number
  ) {
    const oldIndex = modules.findIndex((m) => m.id === activeId);
    const newIndex = modules.findIndex((m) => m.id === overId);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newModules = arrayMove(modules, oldIndex, newIndex);
      setModules(newModules);
      startTransition(async () => {
        try {
          const result = await reorderModulesAction(
            course.id,
            newModules.map((moduleData) => moduleData.id)
          );
          if (!result.ok) {
            setModules(initialModules);
            toast.error(result.message);
          }
        } catch {
          setModules(initialModules);
          toast.error("Não foi possível salvar a nova ordem. Tente novamente.");
        }
      });
    }
  }

  function persistLessonReorder(activeLessonId: string) {
    const reorderGroups = getAffectedLessonReorderGroups({
      activeLessonId,
      currentLessons: lessons,
      initialLessons,
    });

    if (reorderGroups.length === 0) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await reorderLessonsAction(course.id, reorderGroups);
        if (!result.ok) {
          setLessons(initialLessons);
          toast.error(result.message);
        }
      } catch {
        setLessons(initialLessons);
        toast.error("Não foi possível salvar a nova ordem. Tente novamente.");
      }
    });
  }

  function handleLessonDragEnd(
    activeId: string | number,
    overId: string | number
  ) {
    const finalLesson = lessons.find((l) => l.id === activeId);
    if (!finalLesson) {
      return;
    }

    if (activeId === overId) {
      const originalLesson = initialLessons.find((l) => l.id === activeId);
      if (originalLesson && originalLesson.moduleId !== finalLesson.moduleId) {
        persistLessonReorder(finalLesson.id);
      }
    } else {
      persistLessonReorder(finalLesson.id);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!editable || isPending) {
      dragOverRef.current = null;
      setDropPreview(null);
      dragSnapshotRef.current = null;
      setActiveId(null);
      setActiveType(null);
      setActiveLabel(null);
      setActiveWidth(null);
      return;
    }

    const { active, over } = event;
    if (!over) {
      handleDragCancel();
      return;
    }
    dragOverRef.current = null;
    setDropPreview(null);
    dragSnapshotRef.current = null;
    setActiveId(null);
    setActiveType(null);
    setActiveLabel(null);
    setActiveWidth(null);

    const type = active.data.current?.type;

    if (type === "module") {
      if (active.id !== over.id) {
        handleModuleDragEnd(active.id, over.id);
      }
    } else if (type === "lesson") {
      handleLessonDragEnd(active.id, over.id);
    }
  }

  function handleDragCancel() {
    const snapshot = dragSnapshotRef.current;
    if (snapshot) {
      setExpandedModuleIds(snapshot.expandedModuleIds);
      setModules(snapshot.modules);
      setLessons(snapshot.lessons);
    }
    dragOverRef.current = null;
    setDropPreview(null);
    dragSnapshotRef.current = null;
    setActiveId(null);
    setActiveType(null);
    setActiveLabel(null);
    setActiveWidth(null);
  }

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: "0.5" } },
    }),
  };

  return (
    <DndContext
      accessibility={accessibility}
      collisionDetection={closestCenter}
      id="course-builder-dnd"
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <div className="flex flex-col gap-4">
        {isPending ? (
          <p
            aria-live="polite"
            className="text-muted-foreground text-sm"
            role="status"
          >
            Salvando ordem…
          </p>
        ) : null}
        {toolbar || modules.length > 1 ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-border/60 border-b pb-2">
            <div className="flex flex-wrap items-center gap-2">
              {modules.length > 1 ? (
                <Button
                  aria-label={
                    areAllModulesExpanded
                      ? "Recolher todos os módulos"
                      : "Expandir todos os módulos"
                  }
                  onClick={() => {
                    setExpandedModuleIds(
                      areAllModulesExpanded
                        ? new Set()
                        : new Set(modules.map((module) => module.id))
                    );
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {areAllModulesExpanded ? "Recolher tudo" : "Expandir tudo"}
                </Button>
              ) : null}
              {toolbar}
            </div>
          </div>
        ) : null}
        <SortableContext
          items={modules.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-4">
            {modules.map((moduleData, moduleIndex) => {
              const moduleLessons = lessons.filter(
                (l) => l.moduleId === moduleData.id
              );
              const moduleDropPreview =
                dropPreview?.type === "module" &&
                dropPreview.id === moduleData.id
                  ? dropPreview.placement
                  : null;
              return (
                <SortableItem
                  ariaLabel={`Reordenar módulo ${moduleData.title}`}
                  className="overflow-hidden rounded-lg border bg-background/35 shadow-sm"
                  data={{ type: "module" }}
                  disabled={!editable || isPending}
                  dropPlacementOverride={moduleDropPreview}
                  handleAlignment="start"
                  handleClassName="ml-1"
                  handleHidden={!editable}
                  id={moduleData.id}
                  key={moduleData.id}
                >
                  {renderModule(moduleData, moduleLessons, moduleIndex, {
                    contentId: `course-module-${moduleData.id}-lessons`,
                    expanded: expandedModuleIds.has(moduleData.id),
                    onToggle: () => {
                      setExpandedModuleIds((current) => {
                        const next = new Set(current);
                        if (next.has(moduleData.id)) {
                          next.delete(moduleData.id);
                        } else {
                          next.add(moduleData.id);
                        }
                        return next;
                      });
                    },
                  })}
                  {expandedModuleIds.has(moduleData.id) ? (
                    <div
                      className="bg-muted/30"
                      id={`course-module-${moduleData.id}-lessons`}
                    >
                      <SortableContext
                        items={moduleLessons.map((l) => l.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {moduleLessons.length > 0 ? (
                          moduleLessons.map((lesson, lessonIndex) => (
                            <SortableLesson
                              disabled={!editable || isPending}
                              dropPlacementOverride={getLessonDropPlacement(
                                dropPreview,
                                lesson.id
                              )}
                              handleHidden={!editable}
                              key={lesson.id}
                              lesson={lesson}
                            >
                              {renderLesson(lesson, moduleData, lessonIndex)}
                            </SortableLesson>
                          ))
                        ) : (
                          <p className="border-t px-5 py-4 text-muted-foreground text-sm">
                            Nenhuma aula cadastrada neste módulo.
                          </p>
                        )}
                      </SortableContext>
                    </div>
                  ) : null}
                </SortableItem>
              );
            })}
          </div>
        </SortableContext>
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeId ? (
          <div
            className="flex min-w-0 max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border bg-card px-4 py-3 opacity-95 shadow-xl"
            style={{
              width: activeWidth ? `${activeWidth}px` : undefined,
            }}
          >
            <HugeiconsIcon
              aria-hidden="true"
              className="shrink-0 text-muted-foreground"
              icon={Menu01Icon}
              size={18}
              strokeWidth={2}
            />
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">
                {activeType === "module" ? "Módulo" : "Aula"}
              </p>
              <p className="truncate font-medium text-sm">
                {activeLabel ?? "Conteúdo"}
              </p>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
