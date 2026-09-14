"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AlertCircleIcon, CloudUploadIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  ResourceDropzoneEmpty,
  ResourceItemSkeleton,
  ResourceListBody,
  ResourceListContainer,
  ResourceListHeader,
} from "@/components/ui/resource-list";
import {
  deleteAuthMediaAction,
  reorderAuthMediaAction,
  saveAuthMediaAction,
  toggleAuthMediaActiveAction,
} from "@/features/auth-media/actions";
import { AuthMediaCropDialog } from "@/features/auth-media/auth-media-crop-dialog";
import { AUTH_MEDIA_MAX_SLIDES } from "@/features/auth-media/contract";
import { readAuthMediaFileSelection } from "@/features/auth-media/file-selection";
import type { AdminAuthMediaSlide } from "@/features/auth-media/types";
import {
  AUTH_MEDIA_ACCEPT,
  validateAuthMediaSourceRequest,
} from "@/features/storage/auth-media-image-contract";
import { uploadStagedAdminImage } from "@/features/storage/staged-image-upload-client";
import { cn } from "@/lib/utils";
import { SortableAuthMediaItem } from "./sortable-auth-media-item";

interface AuthMediaGalleryProps {
  initialSlides: AdminAuthMediaSlide[];
}

export function AuthMediaGallery({
  initialSlides,
}: AuthMediaGalleryProps): React.JSX.Element {
  const router = useRouter();
  const [slides, setSlides] = useState(initialSlides);
  const [pendingCropFiles, setPendingCropFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<
    { file: File; id: string }[]
  >([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSlides(initialSlides);
  }, [initialSlides]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const uploadFile = useCallback(
    async (file: File): Promise<void> => {
      if (slides.length >= AUTH_MEDIA_MAX_SLIDES) {
        setErrors(["Limite de cinco imagens atingido."]);
        return;
      }

      const temporaryId = String(Date.now());
      setUploadingFiles((current) => [...current, { file, id: temporaryId }]);
      const toastId = toast.loading("Enviando imagem…");

      try {
        const slideId = crypto.randomUUID();
        const imageUpload = await uploadStagedAdminImage({
          aggregateId: slideId,
          file,
          purpose: "auth-media",
        });
        const formData = new FormData();
        formData.set("imageUpload", JSON.stringify(imageUpload));
        formData.set("isActive", "on");
        formData.set("newSlideId", slideId);
        await saveAuthMediaAction(formData);
        toast.success("Imagem adicionada à tela de acesso.", { id: toastId });
        router.refresh();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível enviar a imagem.",
          { id: toastId }
        );
      } finally {
        setUploadingFiles((current) =>
          current.filter(({ id }) => id !== temporaryId)
        );
      }
    },
    [router, slides.length]
  );

  const handleFileSelection = useCallback(
    (files: FileList | File[]) => {
      try {
        const selectedFiles = readAuthMediaFileSelection(files);
        const availableSlots = AUTH_MEDIA_MAX_SLIDES - slides.length;
        if (selectedFiles.length > availableSlots) {
          throw new Error(
            `Você pode adicionar apenas mais ${availableSlots} imagem(ns).`
          );
        }

        for (const file of selectedFiles) {
          validateAuthMediaSourceRequest({
            contentType: file.type,
            sizeBytes: file.size,
          });
        }

        setErrors([]);
        setPendingCropFiles(selectedFiles);
      } catch (error: unknown) {
        setErrors([
          error instanceof Error
            ? error.message
            : "Não foi possível ler as imagens.",
        ]);
      }
    },
    [slides.length]
  );

  const handleFiles = useCallback(
    (files: FileList | File[]): void => {
      if (slides.length >= AUTH_MEDIA_MAX_SLIDES) {
        setErrors(["Limite de cinco imagens atingido."]);
        return;
      }
      handleFileSelection(files);
    },
    [handleFileSelection, slides.length]
  );

  const handleCropComplete = useCallback(
    async (file: File): Promise<void> => {
      setPendingCropFiles((current) => current.slice(1));
      await uploadFile(file);
    },
    [uploadFile]
  );

  const handleDragEnd = (event: DragEndEvent): void => {
    if (isPending) {
      return;
    }
    const { active, over } = event;
    if (!(over && active.id !== over.id)) {
      return;
    }

    const oldIndex = slides.findIndex((slide) => slide.id === active.id);
    const newIndex = slides.findIndex((slide) => slide.id === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const previousSlides = slides;
    const nextSlides = arrayMove(slides, oldIndex, newIndex).map(
      (slide, index) => ({ ...slide, sortOrder: index + 1 })
    );
    setSlides(nextSlides);
    startTransition(async () => {
      try {
        await reorderAuthMediaAction(nextSlides.map((slide) => slide.id));
        toast.success("Ordem das imagens atualizada.");
      } catch {
        setSlides(previousSlides);
        toast.error("Não foi possível salvar a nova ordem.");
      }
    });
  };

  const handleToggle = (slideId: string, isActive: boolean): void => {
    const previousSlides = slides;
    setSlides((current) =>
      current.map((slide) =>
        slide.id === slideId ? { ...slide, isActive } : slide
      )
    );
    startTransition(async () => {
      const formData = new FormData();
      formData.set("isActive", isActive ? "on" : "off");
      formData.set("slideId", slideId);
      try {
        await toggleAuthMediaActiveAction(formData);
        toast.success(isActive ? "Imagem ativada." : "Imagem desativada.");
      } catch {
        setSlides(previousSlides);
        toast.error("Não foi possível atualizar a imagem.");
      }
    });
  };

  const handleDelete = (slideId: string): void => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("slideId", slideId);
      try {
        await deleteAuthMediaAction(formData);
        setSlides((current) => current.filter((slide) => slide.id !== slideId));
        toast.success("Imagem removida.");
        router.refresh();
      } catch {
        toast.error("Não foi possível remover a imagem.");
      }
    });
  };

  return (
    <div className="w-full">
      <ResourceListContainer
        className={cn(
          "p-3",
          isDragging ? "border-primary bg-primary/5" : "",
          (uploadingFiles.length > 0 || isPending) &&
            "pointer-events-none opacity-50"
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (event.dataTransfer.files.length > 0) {
            handleFiles(event.dataTransfer.files);
          }
        }}
      >
        <ResourceListHeader
          actions={
            slides.length < AUTH_MEDIA_MAX_SLIDES ? (
              <div className="relative">
                <input
                  accept={AUTH_MEDIA_ACCEPT}
                  aria-label="Selecionar imagens da tela de acesso"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  multiple
                  onChange={(event) => {
                    const files = event.currentTarget.files;
                    if (files && files.length > 0) {
                      handleFiles(files);
                    }
                    event.currentTarget.value = "";
                  }}
                  title="Enviar imagens"
                  type="file"
                />
                <Button
                  className="pointer-events-none h-8 px-3"
                  size="sm"
                  variant="outline"
                >
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="-ms-0.5 mr-1.5 opacity-60"
                    icon={CloudUploadIcon}
                    size={14}
                  />
                  Adicionar imagens
                </Button>
              </div>
            ) : null
          }
          count={slides.length}
          title="Imagens cadastradas"
        />

        {slides.length > 0 || uploadingFiles.length > 0 ? (
          <ResourceListBody>
            <DndContext
              collisionDetection={closestCenter}
              id="auth-media-gallery-dnd"
              onDragEnd={handleDragEnd}
              sensors={sensors}
            >
              <SortableContext
                items={slides}
                strategy={verticalListSortingStrategy}
              >
                {slides.map((slide) => (
                  <SortableAuthMediaItem
                    key={slide.id}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                    slide={slide}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {uploadingFiles.map(({ id }) => (
              <ResourceItemSkeleton key={id} />
            ))}
          </ResourceListBody>
        ) : (
          <ResourceDropzoneEmpty />
        )}
      </ResourceListContainer>

      {errors.length > 0 ? (
        <Alert className="mt-5" variant="destructive">
          <HugeiconsIcon
            aria-hidden="true"
            icon={AlertCircleIcon}
            strokeWidth={2}
          />
          <AlertTitle>Erro ao enviar imagem</AlertTitle>
          <AlertDescription>
            {errors.map((error) => (
              <p className="last:mb-0" key={error}>
                {error}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      <AuthMediaCropDialog
        file={pendingCropFiles[0] ?? null}
        onCancel={() => setPendingCropFiles([])}
        onComplete={handleCropComplete}
      />
    </div>
  );
}
