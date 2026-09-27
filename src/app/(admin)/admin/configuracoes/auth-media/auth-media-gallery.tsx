"use client";

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AlertCircleIcon, CloudUploadIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createSortableAccessibility,
  useSortableSensors,
} from "@/components/sortable-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  ResourceDropzoneEmpty,
  ResourceListBody,
  ResourceListContainer,
  ResourceListHeader,
} from "@/components/ui/resource-list";
import { UploadProgressStatus } from "@/components/ui/upload-progress-status";
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
  AUTH_MEDIA_MAX_BYTES,
  validateAuthMediaSourceRequest,
} from "@/features/storage/auth-media-image-contract";
import { uploadStagedAdminImage } from "@/features/storage/staged-image-upload-client";
import {
  isUploadAbortedError,
  type UploadStatusPhase,
  type UploadTransferProgress,
} from "@/features/storage/xhr-upload";
import { cn } from "@/lib/utils";
import { SortableAuthMediaItem } from "./sortable-auth-media-item";

interface AuthMediaGalleryProps {
  initialSlides: AdminAuthMediaSlide[];
  readOnly?: boolean;
}

interface UploadingAuthMedia {
  errorMessage?: string | undefined;
  file: File;
  id: string;
  phase: UploadStatusPhase;
  progress?: UploadTransferProgress | null | undefined;
  retryable?: boolean;
  status?: "error" | undefined;
  targetSlideId?: string;
}

const beginAuthMediaUpload = (
  current: UploadingAuthMedia[],
  file: File,
  id: string,
  phase: UploadStatusPhase
): UploadingAuthMedia[] => {
  const existingUpload = current.find((upload) => upload.id === id);
  if (!existingUpload) {
    return [...current, { file, id, phase }];
  }

  return current.map((upload) =>
    upload.id === id
      ? {
          ...upload,
          errorMessage: undefined,
          phase,
          progress: undefined,
          retryable: false,
          status: undefined,
        }
      : upload
  );
};

const getAuthMediaUploadErrorMessage = (
  error: unknown,
  phase: UploadStatusPhase
): string => {
  if (phase === "saving") {
    return "Não foi possível confirmar se a imagem foi salva. Atualize a lista antes de tentar novamente.";
  }
  return error instanceof Error
    ? error.message
    : "Não foi possível enviar a imagem.";
};

export function AuthMediaGallery({
  initialSlides,
  readOnly = false,
}: AuthMediaGalleryProps): React.JSX.Element {
  const router = useRouter();
  const [slides, setSlides] = useState(initialSlides);
  const [pendingCropFiles, setPendingCropFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingAuthMedia[]>(
    []
  );
  const uploadAbortControllersRef = useRef(new Map<string, AbortController>());
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const activeUploadCount = uploadingFiles.filter(
    (upload) => upload.status !== "error"
  ).length;

  useEffect(() => {
    setSlides(initialSlides);
    const persistedSlideIds = new Set(initialSlides.map(({ id }) => id));
    setUploadingFiles((current) =>
      current.filter(
        (upload) =>
          !(
            upload.status === "error" &&
            upload.targetSlideId &&
            persistedSlideIds.has(upload.targetSlideId)
          )
      )
    );
  }, [initialSlides]);

  useEffect(
    () => () => {
      for (const controller of uploadAbortControllersRef.current.values()) {
        controller.abort();
      }
      uploadAbortControllersRef.current.clear();
    },
    []
  );

  const sensors = useSortableSensors();
  const accessibility = createSortableAccessibility((id) => {
    const slide = slides.find((item) => item.id === id);
    return slide ? `imagem ${slide.sortOrder}` : `imagem ${id}`;
  });

  const uploadFile = useCallback(
    async (file: File, retryUploadId?: string): Promise<void> => {
      if (slides.length + activeUploadCount >= AUTH_MEDIA_MAX_SLIDES) {
        setErrors(["Limite de cinco imagens atingido."]);
        return;
      }

      const temporaryId = retryUploadId ?? crypto.randomUUID();
      if (uploadAbortControllersRef.current.has(temporaryId)) {
        return;
      }
      const abortController = new AbortController();
      uploadAbortControllersRef.current.set(temporaryId, abortController);
      let currentPhase: UploadStatusPhase = "preparing";
      setUploadingFiles((current) =>
        beginAuthMediaUpload(current, file, temporaryId, currentPhase)
      );
      let keepErrorRow = false;

      try {
        const slideId = temporaryId;
        const imageUpload = await uploadStagedAdminImage({
          aggregateId: slideId,
          file,
          onStatus: (status) => {
            currentPhase = status.phase;
            setUploadingFiles((current) =>
              current.map((upload) =>
                upload.id === temporaryId
                  ? {
                      ...upload,
                      phase: status.phase,
                      progress: status.progress,
                      errorMessage: undefined,
                      retryable: false,
                      status: undefined,
                    }
                  : upload
              )
            );
          },
          purpose: "auth-media",
          signal: abortController.signal,
        });
        setUploadingFiles((current) =>
          current.map((upload) =>
            upload.id === temporaryId
              ? {
                  ...upload,
                  errorMessage: undefined,
                  phase: "saving",
                  progress: undefined,
                  retryable: false,
                  status: undefined,
                }
              : upload
          )
        );
        currentPhase = "saving";
        uploadAbortControllersRef.current.delete(temporaryId);
        const formData = new FormData();
        formData.set("imageUpload", JSON.stringify(imageUpload));
        formData.set("isActive", "on");
        formData.set("newSlideId", slideId);
        await saveAuthMediaAction(formData);
        toast.success("Imagem adicionada à tela de acesso.");
        router.refresh();
      } catch (error: unknown) {
        if (isUploadAbortedError(error, abortController.signal)) {
          return;
        }
        const message = getAuthMediaUploadErrorMessage(error, currentPhase);
        keepErrorRow = true;
        if (currentPhase === "saving") {
          router.refresh();
        }
        setUploadingFiles((current) =>
          current.map((upload) =>
            upload.id === temporaryId
              ? {
                  ...upload,
                  errorMessage: message,
                  phase: currentPhase,
                  progress: undefined,
                  retryable: currentPhase !== "saving",
                  status: "error",
                  targetSlideId: temporaryId,
                }
              : upload
          )
        );
      } finally {
        if (
          uploadAbortControllersRef.current.get(temporaryId) === abortController
        ) {
          uploadAbortControllersRef.current.delete(temporaryId);
        }
        if (!keepErrorRow) {
          setUploadingFiles((current) =>
            current.filter(({ id }) => id !== temporaryId)
          );
        }
      }
    },
    [activeUploadCount, router, slides.length]
  );

  const retryUpload = async (uploadId: string): Promise<void> => {
    if (activeUploadCount > 0 || pendingCropFiles.length > 0) {
      return;
    }
    const upload = uploadingFiles.find(
      (candidate) => candidate.id === uploadId && candidate.status === "error"
    );
    if (
      !(upload?.retryable && upload.errorMessage) ||
      uploadAbortControllersRef.current.has(uploadId)
    ) {
      return;
    }
    try {
      await uploadFile(upload.file, upload.id);
    } catch {
      setErrors([`${upload.file.name}: Não foi possível retomar o envio.`]);
    }
  };

  const discardUpload = (uploadId: string): void => {
    setUploadingFiles((current) =>
      current.filter((upload) => upload.id !== uploadId)
    );
  };

  const handleFileSelection = useCallback(
    (files: FileList | File[]) => {
      if (readOnly) {
        return;
      }
      if (activeUploadCount > 0 || pendingCropFiles.length > 0) {
        setErrors([
          "Conclua os envios e recortes atuais antes de adicionar imagens.",
        ]);
        return;
      }
      try {
        const selectedFiles = readAuthMediaFileSelection(files);
        const availableSlots =
          AUTH_MEDIA_MAX_SLIDES -
          slides.length -
          activeUploadCount -
          pendingCropFiles.length;
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
    [activeUploadCount, pendingCropFiles.length, readOnly, slides.length]
  );

  const handleFiles = useCallback(
    (files: FileList | File[]): void => {
      if (readOnly) {
        return;
      }
      if (
        slides.length + activeUploadCount + pendingCropFiles.length >=
        AUTH_MEDIA_MAX_SLIDES
      ) {
        setErrors(["Limite de cinco imagens atingido."]);
        return;
      }
      handleFileSelection(files);
    },
    [
      handleFileSelection,
      activeUploadCount,
      pendingCropFiles.length,
      readOnly,
      slides.length,
    ]
  );

  const handleCropComplete = useCallback(
    async (file: File): Promise<void> => {
      setPendingCropFiles((current) => current.slice(1));
      await uploadFile(file);
    },
    [uploadFile]
  );

  const handleDragEnd = (event: DragEndEvent): void => {
    if (readOnly || isPending || activeUploadCount > 0) {
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
        className={cn("p-3", isDragging ? "border-primary bg-primary/5" : "")}
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
            !readOnly &&
            activeUploadCount === 0 &&
            pendingCropFiles.length === 0 &&
            slides.length + activeUploadCount + pendingCropFiles.length <
              AUTH_MEDIA_MAX_SLIDES ? (
              <label
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  "h-8 cursor-pointer px-3 focus-within:border-focus focus-within:outline-2 focus-within:outline-focus focus-within:outline-offset-2 focus-within:ring-2 focus-within:ring-background data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                )}
              >
                <input
                  accept={AUTH_MEDIA_ACCEPT}
                  className="sr-only"
                  disabled={
                    activeUploadCount > 0 || pendingCropFiles.length > 0
                  }
                  multiple
                  onChange={(event) => {
                    const files = event.currentTarget.files;
                    if (files && files.length > 0) {
                      handleFiles(files);
                    }
                    event.currentTarget.value = "";
                  }}
                  type="file"
                />
                <HugeiconsIcon
                  aria-hidden="true"
                  className="-ms-0.5 mr-1.5 opacity-60"
                  icon={CloudUploadIcon}
                  size={14}
                />
                Adicionar imagens
              </label>
            ) : null
          }
          count={slides.length}
          description={`Até ${AUTH_MEDIA_MAX_SLIDES} imagens · proporção 8:7 · JPG, PNG ou WebP · até ${Math.round(AUTH_MEDIA_MAX_BYTES / (1024 * 1024))} MiB por imagem.`}
          title="Imagens cadastradas"
        />

        {slides.length > 0 || uploadingFiles.length > 0 ? (
          <ResourceListBody>
            <DndContext
              accessibility={accessibility}
              collisionDetection={closestCenter}
              id="auth-media-gallery-dnd"
              onDragEnd={handleDragEnd}
              sensors={
                readOnly || isPending || activeUploadCount > 0 ? [] : sensors
              }
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
                    readOnly={readOnly}
                    slide={slide}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {uploadingFiles.map((upload) => (
              <UploadProgressStatus
                errorMessage={
                  upload.status === "error" ? upload.errorMessage : undefined
                }
                fileName={upload.file.name}
                key={upload.id}
                onCancel={
                  upload.status === "error" || upload.phase === "saving"
                    ? undefined
                    : () =>
                        uploadAbortControllersRef.current
                          .get(upload.id)
                          ?.abort()
                }
                onDiscard={
                  upload.status === "error"
                    ? () => discardUpload(upload.id)
                    : undefined
                }
                onRetry={
                  upload.status === "error" &&
                  upload.retryable &&
                  activeUploadCount === 0 &&
                  pendingCropFiles.length === 0
                    ? () => retryUpload(upload.id)
                    : undefined
                }
                phase={upload.phase}
                progress={upload.progress}
              />
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
