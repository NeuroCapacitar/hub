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
  deleteBannerAction,
  reorderBannersAction,
  saveBannerAction,
} from "@/features/admin/actions";
import type { AdminBanner } from "@/features/admin/server";
import { BannerCropDialog } from "@/features/banners/banner-crop-dialog";
import {
  BANNER_ACCEPT,
  MAX_BANNER_BYTES,
  validateBannerUploadRequest,
} from "@/features/storage/banner-image";
import { uploadStagedAdminImage } from "@/features/storage/staged-image-upload-client";
import {
  isUploadAbortedError,
  type UploadStatusPhase,
  type UploadTransferProgress,
} from "@/features/storage/xhr-upload";
import { createObjectUrlRegistry } from "@/lib/object-url-registry";
import { cn } from "@/lib/utils";
import { BannerEditModal } from "./banner-edit-modal";
import { readBannerFileSelection } from "./banner-file-selection";
import { SortableBannerItem } from "./sortable-banner-item";

interface BannerGalleryProps {
  initialBanners: AdminBanner[];
  readOnly?: boolean;
}

interface UploadingBanner {
  errorMessage?: string | undefined;
  file: File;
  id: string;
  phase: UploadStatusPhase;
  progress?: UploadTransferProgress | null | undefined;
  retryable?: boolean | undefined;
  status?: "error" | undefined;
  targetBannerId?: string;
}

interface BannerUploadResult {
  bannerId?: string;
  error?: string;
  uploadId?: string;
}

const getBannerUploadError = (
  file: File,
  currentCount: number,
  maxCount: number
): string | null => {
  if (!file.type.startsWith("image/")) {
    return "O arquivo deve ser uma imagem.";
  }
  try {
    validateBannerUploadRequest({
      contentType: file.type,
      sizeBytes: file.size,
    });
  } catch (error) {
    return error instanceof Error ? error.message : "Banner não permitido.";
  }
  return currentCount >= maxCount
    ? `Limite de ${maxCount} banners atingido.`
    : null;
};

const uploadAndSaveBanner = async ({
  bannerId,
  file,
  onSaving,
  onStatus,
  signal,
}: {
  bannerId: string;
  file: File;
  onSaving: () => void;
  onStatus: (status: {
    phase: UploadStatusPhase;
    progress?: UploadTransferProgress;
  }) => void;
  signal: AbortSignal;
}): Promise<{ bannerId?: string }> => {
  const newBannerId = bannerId;
  const imageUpload = await uploadStagedAdminImage({
    aggregateId: newBannerId,
    file,
    onStatus,
    purpose: "dashboard-banner",
    signal,
  });
  onSaving();
  const formData = new FormData();
  formData.append("newBannerId", newBannerId);
  formData.append("imageUpload", JSON.stringify(imageUpload));
  formData.append("isActive", "on");
  return (await saveBannerAction(formData)) ?? {};
};

const patchUploadingBanner = (
  current: UploadingBanner[],
  id: string,
  patch: Partial<UploadingBanner>
): UploadingBanner[] =>
  current.map((upload) =>
    upload.id === id ? { ...upload, ...patch } : upload
  );

const getBannerUploadErrorMessage = (
  error: unknown,
  phase: UploadStatusPhase
): string => {
  if (phase === "saving") {
    return "Não foi possível confirmar se o banner foi salvo. Atualize a lista antes de tentar novamente.";
  }
  return error instanceof Error ? error.message : "Erro ao enviar banner.";
};

const uploadBannerBatch = async (
  files: File[],
  uploadFile: (file: File) => Promise<BannerUploadResult>
): Promise<{ errors: string[]; firstBannerId: string | null }> => {
  const errors: string[] = [];
  let firstBannerId: string | null = null;

  for (const file of files) {
    const result = await uploadFile(file);
    if (result.error && !result.uploadId) {
      errors.push(`${file.name}: ${result.error}`);
    } else if (result.bannerId && !firstBannerId) {
      firstBannerId = result.bannerId;
    }
  }

  return { errors, firstBannerId };
};

export function BannerGallery({
  initialBanners,
  readOnly = false,
}: BannerGalleryProps) {
  const router = useRouter();
  const [banners, setBanners] = useState<AdminBanner[]>(initialBanners);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [editingBanner, setEditingBanner] = useState<AdminBanner | null>(null);
  const [autoOpenBannerId, setAutoOpenBannerId] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingBanner[]>([]);
  const uploadAbortControllersRef = useRef(new Map<string, AbortController>());
  const optimisticBannerPreviewsRef = useRef(
    new Map<string, { banner: AdminBanner; url: string }>()
  );
  const objectUrlRegistryRef = useRef<ReturnType<
    typeof createObjectUrlRegistry
  > | null>(null);
  if (!objectUrlRegistryRef.current) {
    objectUrlRegistryRef.current = createObjectUrlRegistry();
  }
  const objectUrlRegistry = objectUrlRegistryRef.current;
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const isProcessingFilesRef = useRef(false);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const activeUploadCount = uploadingFiles.filter(
    (upload) => upload.status !== "error"
  ).length;

  // Auto-open modal when a new banner finishes uploading and is available in props
  useEffect(() => {
    if (autoOpenBannerId) {
      const found = banners.find((b) => b.id === autoOpenBannerId);
      if (found) {
        setEditingBanner(found);
        setAutoOpenBannerId(null);
      }
    }
  }, [banners, autoOpenBannerId]);

  useEffect(() => {
    const persistedBannerIds = new Set(initialBanners.map(({ id }) => id));
    for (const [id, preview] of optimisticBannerPreviewsRef.current) {
      if (persistedBannerIds.has(id)) {
        objectUrlRegistry.revoke(preview.url);
        optimisticBannerPreviewsRef.current.delete(id);
      }
    }
    setUploadingFiles((current) =>
      current.filter(
        (upload) =>
          !(
            upload.status === "error" &&
            upload.targetBannerId &&
            persistedBannerIds.has(upload.targetBannerId)
          )
      )
    );
    const pendingOptimisticBanners = Array.from(
      optimisticBannerPreviewsRef.current.values(),
      ({ banner }) => banner
    );
    setBanners([...initialBanners, ...pendingOptimisticBanners]);
  }, [initialBanners, objectUrlRegistry]);

  useEffect(
    () => () => {
      for (const controller of uploadAbortControllersRef.current.values()) {
        controller.abort();
      }
      uploadAbortControllersRef.current.clear();
      objectUrlRegistry.revokeAll();
      optimisticBannerPreviewsRef.current.clear();
    },
    [objectUrlRegistry]
  );

  const sensors = useSortableSensors();
  const accessibility = createSortableAccessibility((id) => {
    const banner = banners.find((item) => item.id === id);
    return banner
      ? `banner ${banner.buttonText ?? banner.linkUrl ?? banner.id}`
      : `banner ${id}`;
  });

  const maxFiles = 5;
  const handleDragEnd = (event: DragEndEvent) => {
    if (readOnly || isPending || activeUploadCount > 0) {
      return;
    }

    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = banners.findIndex((item) => item.id === active.id);
      const newIndex = banners.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const previousBanners = banners;
      const newOrder = arrayMove(banners, oldIndex, newIndex);
      setBanners(newOrder);

      startTransition(async () => {
        try {
          await reorderBannersAction(newOrder.map((b) => b.id));
          toast.success("Ordem dos banners atualizada.");
        } catch {
          setBanners(previousBanners);
          toast.error("Não foi possível salvar a nova ordem.");
        }
      });
    }
  };

  const uploadFile = useCallback(
    async (file: File, retryUploadId?: string): Promise<BannerUploadResult> => {
      const validationError = getBannerUploadError(
        file,
        banners.length,
        maxFiles
      );
      if (validationError) {
        return { error: validationError };
      }

      const tempId = retryUploadId ?? crypto.randomUUID();
      if (uploadAbortControllersRef.current.has(tempId)) {
        return {};
      }
      const abortController = new AbortController();
      uploadAbortControllersRef.current.set(tempId, abortController);
      let currentPhase: UploadStatusPhase = "preparing";
      setUploadingFiles((current) => {
        const retrying = current.some((upload) => upload.id === tempId);
        return retrying
          ? current.map((upload) =>
              upload.id === tempId
                ? {
                    ...upload,
                    errorMessage: undefined,
                    phase: currentPhase,
                    progress: undefined,
                    retryable: false,
                    status: undefined,
                  }
                : upload
            )
          : [...current, { file, id: tempId, phase: currentPhase }];
      });
      let keepErrorRow = false;

      try {
        const result = await uploadAndSaveBanner({
          bannerId: tempId,
          file,
          onSaving: () => {
            currentPhase = "saving";
            setUploadingFiles((current) =>
              patchUploadingBanner(current, tempId, {
                errorMessage: undefined,
                phase: currentPhase,
                progress: undefined,
                retryable: false,
                status: undefined,
              })
            );
            uploadAbortControllersRef.current.delete(tempId);
          },
          onStatus: (status) => {
            currentPhase = status.phase;
            setUploadingFiles((current) =>
              patchUploadingBanner(current, tempId, {
                errorMessage: undefined,
                phase: status.phase,
                progress: status.progress,
                retryable: false,
                status: undefined,
              })
            );
          },
          signal: abortController.signal,
        });

        if (result.bannerId) {
          const previewUrl = objectUrlRegistry.create(file);
          const optimisticBanner: AdminBanner = {
            blurDataUrl: null,
            id: result.bannerId,
            imageUrl: previewUrl,
            isActive: true,
            linkUrl: null,
            buttonText: null,
            sortOrder: banners.length + 1,
          };
          optimisticBannerPreviewsRef.current.set(result.bannerId, {
            banner: optimisticBanner,
            url: previewUrl,
          });
          setBanners((prev) => [...prev, optimisticBanner]);
        }

        toast.success("Banner enviado com sucesso.");
        return result;
      } catch (error: unknown) {
        if (isUploadAbortedError(error, abortController.signal)) {
          return {};
        }
        const message = getBannerUploadErrorMessage(error, currentPhase);
        keepErrorRow = true;
        setUploadingFiles((current) =>
          patchUploadingBanner(current, tempId, {
            errorMessage: message,
            phase: currentPhase,
            progress: undefined,
            retryable: currentPhase !== "saving",
            status: "error",
            targetBannerId: tempId,
          })
        );
        return {
          error: message,
          uploadId: tempId,
        };
      } finally {
        if (uploadAbortControllersRef.current.get(tempId) === abortController) {
          uploadAbortControllersRef.current.delete(tempId);
        }
        if (!keepErrorRow) {
          setUploadingFiles((current) =>
            current.filter((upload) => upload.id !== tempId)
          );
        }
      }
    },
    [banners.length, objectUrlRegistry]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (readOnly) {
        return;
      }
      if (isProcessingFilesRef.current) {
        setErrors([
          "Aguarde o envio atual terminar antes de adicionar banners.",
        ]);
        return;
      }
      const filesArray = Array.from(files);

      if (banners.length + activeUploadCount + filesArray.length > maxFiles) {
        setErrors(["Você só pode adicionar até 5 banners no total."]);
        return;
      }

      isProcessingFilesRef.current = true;
      setIsProcessingFiles(true);
      setErrors([]);
      try {
        const result = await uploadBannerBatch(filesArray, uploadFile);

        if (result.errors.length > 0) {
          setErrors(result.errors);
        }

        router.refresh();

        if (result.firstBannerId) {
          setAutoOpenBannerId(result.firstBannerId);
        }
      } finally {
        isProcessingFilesRef.current = false;
        setIsProcessingFiles(false);
      }
    },
    [activeUploadCount, banners.length, readOnly, uploadFile, router]
  );

  const retryBannerUpload = async (uploadId: string): Promise<void> => {
    if (isProcessingFilesRef.current || activeUploadCount > 0) {
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
      const result = await uploadFile(upload.file, upload.id);
      if (result.error && !result.uploadId) {
        setErrors([`${upload.file.name}: ${result.error}`]);
      }
      if (result.bannerId) {
        router.refresh();
        setAutoOpenBannerId(result.bannerId);
      }
    } catch {
      setErrors([`${upload.file.name}: Não foi possível retomar o envio.`]);
    }
  };

  const discardBannerUpload = (uploadId: string): void => {
    setUploadingFiles((current) =>
      current.filter((upload) => upload.id !== uploadId)
    );
  };

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleFileSelection = useCallback(
    (files: FileList | File[]) => {
      if (readOnly) {
        return;
      }
      if (isProcessingFilesRef.current || pendingCropFile) {
        setErrors([
          "Conclua o envio ou recorte atual antes de adicionar outro banner.",
        ]);
        return;
      }
      try {
        const file = readBannerFileSelection(files);
        validateBannerUploadRequest({
          contentType: file.type,
          sizeBytes: file.size,
        });
        setErrors([]);
        setPendingCropFile(file);
      } catch (error: unknown) {
        setErrors([
          error instanceof Error
            ? error.message
            : "Não foi possível ler o banner.",
        ]);
      }
    },
    [pendingCropFile, readOnly]
  );

  const handleCropComplete = useCallback(
    async (file: File) => {
      setPendingCropFile(null);
      await handleFiles([file]);
    },
    [handleFiles]
  );

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelection(files);
      }
    },
    [handleFileSelection]
  );

  const removeBanner = (id: string) => {
    const toastId = toast.loading("Removendo…");
    const formData = new FormData();
    formData.append("bannerId", id);
    startTransition(async () => {
      try {
        await deleteBannerAction(formData);
        const optimisticPreview = optimisticBannerPreviewsRef.current.get(id);
        if (optimisticPreview) {
          objectUrlRegistry.revoke(optimisticPreview.url);
          optimisticBannerPreviewsRef.current.delete(id);
        }
        toast.success("Banner excluído.", { id: toastId });
      } catch {
        toast.error("Erro ao excluir o banner.", { id: toastId });
      }
    });
  };

  return (
    <div className="w-full">
      <div>
        <ResourceListContainer
          className={cn(isDragging ? "border-primary bg-primary/5" : "")}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={(e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={onDrop}
        >
          <ResourceListHeader
            actions={
              !(readOnly || isProcessingFiles || pendingCropFile) &&
              activeUploadCount === 0 &&
              banners.length + activeUploadCount < maxFiles && (
                <label
                  className={cn(
                    buttonVariants({ size: "sm", variant: "outline" }),
                    "h-8 cursor-pointer px-3 focus-within:border-focus focus-within:outline-2 focus-within:outline-focus focus-within:outline-offset-2 focus-within:ring-2 focus-within:ring-background data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                  )}
                >
                  <input
                    accept={BANNER_ACCEPT}
                    className="sr-only"
                    disabled={isProcessingFiles || activeUploadCount > 0}
                    onChange={(event) => {
                      const files = event.currentTarget.files;
                      if (files && files.length > 0) {
                        handleFileSelection(files);
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
                  Adicionar banner
                </label>
              )
            }
            count={banners.length}
            description={`Até ${maxFiles} imagens · proporção 4:1 · JPG, PNG ou WebP · até ${Math.round(MAX_BANNER_BYTES / (1024 * 1024))} MiB por banner.`}
            title="Banners cadastrados"
          />

          {banners.length > 0 || uploadingFiles.length > 0 ? (
            <ResourceListBody>
              <DndContext
                accessibility={accessibility}
                collisionDetection={closestCenter}
                id="banner-gallery-dnd"
                onDragEnd={handleDragEnd}
                sensors={
                  readOnly || isPending || activeUploadCount > 0 ? [] : sensors
                }
              >
                <SortableContext
                  items={banners}
                  strategy={verticalListSortingStrategy}
                >
                  {banners.map((banner) => (
                    <SortableBannerItem
                      banner={banner}
                      key={banner.id}
                      onDelete={() => removeBanner(banner.id)}
                      onEdit={() => setEditingBanner(banner)}
                      readOnly={readOnly}
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
                      ? () => discardBannerUpload(upload.id)
                      : undefined
                  }
                  onRetry={
                    upload.status === "error" &&
                    upload.retryable &&
                    !isProcessingFiles &&
                    activeUploadCount === 0
                      ? () => retryBannerUpload(upload.id)
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
      </div>

      {errors.length > 0 && (
        <Alert className="mt-5" variant="destructive">
          <HugeiconsIcon
            aria-hidden="true"
            icon={AlertCircleIcon}
            strokeWidth={2}
          />
          <AlertTitle>Erro ao enviar arquivo(s)</AlertTitle>
          <AlertDescription>
            {errors.map((error) => (
              <p className="last:mb-0" key={error}>
                {error}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {editingBanner && (
        <BannerEditModal
          banner={editingBanner}
          onClose={() => setEditingBanner(null)}
          open={!!editingBanner}
        />
      )}

      <BannerCropDialog
        file={pendingCropFile}
        onCancel={() => setPendingCropFile(null)}
        onComplete={handleCropComplete}
      />
    </div>
  );
}
