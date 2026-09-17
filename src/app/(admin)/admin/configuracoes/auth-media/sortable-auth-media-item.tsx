"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import {
  ResourceDeleteAction,
  ResourceItem,
  ResourceItemActions,
  ResourceItemContent,
  ResourceItemDragHandle,
  ResourceItemVisual,
} from "@/components/ui/resource-list";
import { Switch } from "@/components/ui/switch";
import type { AdminAuthMediaSlide } from "@/features/auth-media/types";
import { BannerImage } from "@/features/banners/banner-image";
import { cn } from "@/lib/utils";

interface SortableAuthMediaItemProps {
  onDelete: (slideId: string) => void;
  onToggle: (slideId: string, isActive: boolean) => void;
  readOnly?: boolean;
  slide: AdminAuthMediaSlide;
}

export function SortableAuthMediaItem({
  onDelete,
  onToggle,
  readOnly = false,
  slide,
}: SortableAuthMediaItemProps): React.JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  return (
    <ResourceItem
      isDragging={isDragging}
      nodeRef={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {readOnly ? null : (
        <ResourceItemDragHandle
          ariaLabel={`Reordenar imagem ${slide.sortOrder}`}
          attributes={attributes}
          icon={DragDropVerticalIcon}
          listeners={listeners}
        />
      )}

      <ResourceItemVisual
        className={cn(
          "aspect-[8/7] w-12 sm:w-14",
          !slide.isActive && "opacity-50 grayscale"
        )}
      >
        <BannerImage
          alt=""
          blurDataUrl={slide.blurDataUrl}
          className="pointer-events-none object-cover"
          key={slide.imageUrl}
          sizes="80px"
          src={slide.imageUrl}
          unoptimized
        />
      </ResourceItemVisual>

      <ResourceItemContent>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="truncate font-medium text-sm">
            Imagem {slide.sortOrder}
          </p>
          <Badge variant={slide.isActive ? "success" : "outline"}>
            {slide.isActive ? "Ativa" : "Inativa"}
          </Badge>
        </div>
        <p className="truncate text-muted-foreground text-xs">
          Formato 8:7 · WebP
        </p>
      </ResourceItemContent>

      <ResourceItemActions>
        {readOnly ? null : (
          <>
            <Switch
              aria-label={`${slide.isActive ? "Desativar" : "Ativar"} imagem ${slide.sortOrder}`}
              checked={slide.isActive}
              onCheckedChange={(checked) => onToggle(slide.id, checked)}
            />
            <ResourceDeleteAction
              description="Tem certeza que deseja excluir esta imagem permanentemente? A ação não pode ser desfeita."
              onDelete={() => onDelete(slide.id)}
              title="Excluir imagem"
            />
          </>
        )}
      </ResourceItemActions>
    </ResourceItem>
  );
}
