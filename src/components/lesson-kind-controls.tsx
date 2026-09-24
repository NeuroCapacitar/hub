"use client";

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Add01Icon,
  AlertCircleIcon,
  Cancel01Icon,
  CloudUploadIcon,
  Delete02Icon,
  DragDropVerticalIcon,
  File01Icon,
  FileArchiveIcon,
  FileDownloadIcon,
  FileImageIcon,
  FileLinkIcon,
  Link04Icon,
  Pdf01Icon,
  PencilEdit01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { JmvstreamDurationDetector } from "@/components/jmvstream-duration-detector";
import {
  type JmvstreamUploadAsset,
  JmvstreamUploadPanel,
} from "@/components/jmvstream-upload-panel";
import { LessonVideoEditorPreview } from "@/components/lesson-video-editor-preview";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  ResourceDeleteAction,
  ResourceDropzoneEmpty,
  ResourceItem,
  ResourceItemActions,
  ResourceItemContent,
  ResourceItemDragHandle,
  ResourceItemVisual,
  ResourceListBody,
  ResourceListContainer,
  ResourceListHeader,
} from "@/components/ui/resource-list";
import { getUploadStatusLabel } from "@/components/ui/upload-progress-status";
import { resolveLessonVideoPreviewUrl } from "@/features/admin/lesson-video-form";
import type { LessonResource } from "@/features/courses/lesson-content";
import {
  formatResourceFileSize,
  getResourceTypeLabel,
  getResourceExtension as getSharedResourceExtension,
} from "@/features/courses/resource-presentation";
import { JMVSTREAM_PORTAL_URL } from "@/features/jmvstream/portal";
import {
  type LessonResourceUploadPreview,
  type LessonResourceUploadReference,
  uploadLessonResource,
} from "@/features/storage/lesson-resource-upload-client";
import {
  LESSON_ATTACHMENT_ACCEPT,
  LESSON_RESOURCE_IMAGE_PREVIEW,
  MAX_LESSON_ATTACHMENT_BYTES,
  MAX_LESSON_R2_RESOURCES_BYTES,
  MAX_LESSON_RESOURCES,
  validateLessonAttachmentUpload,
} from "@/features/storage/r2-objects";
import {
  isUploadAbortedError,
  UploadAbortedError,
  type UploadStatusPhase,
  type UploadTransferProgress,
} from "@/features/storage/xhr-upload";
import { createObjectUrlRegistry } from "@/lib/object-url-registry";
import { cn } from "@/lib/utils";
import {
  createSortableAccessibility,
  getSortableDropPlacement,
  useSortableSensors,
} from "./sortable-context";

export function LessonVideoControls({
  asset,
  defaultEmbedUrl,
  defaultOrder,
  defaultTitle,
  defaultVideoDurationSeconds,
  defaultVideoExternalId,
  lessonId,
}: {
  asset?: JmvstreamUploadAsset | undefined;
  defaultEmbedUrl: string;
  defaultOrder: number;
  defaultTitle: string;
  defaultVideoDurationSeconds: number;
  defaultVideoExternalId: null | string;
  lessonId?: string | undefined;
}): React.JSX.Element {
  const isJmvstreamUpload = Boolean(defaultVideoExternalId);
  const initialEmbedUrl = isJmvstreamUpload ? "" : defaultEmbedUrl;
  const [appliedEmbedUrl, setAppliedEmbedUrl] = useState(initialEmbedUrl);
  const [linkDraft, setLinkDraft] = useState(initialEmbedUrl);
  const [isRemovePending, setIsRemovePending] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const previewUrl = resolveLessonVideoPreviewUrl({
    savedEmbedUrl: defaultEmbedUrl || null,
    shouldRemoveVideo: isRemovePending,
    submittedEmbedUrl: appliedEmbedUrl || null,
  });
  const isUploadedVideoProcessing =
    !(previewUrl || isRemovePending) &&
    Boolean(defaultVideoExternalId) &&
    asset?.uploadStatus === "processing";
  const hasManualLinkApplied = Boolean(
    appliedEmbedUrl &&
      (!defaultVideoExternalId || appliedEmbedUrl !== defaultEmbedUrl)
  );

  const removeVideoLocally = (): void => {
    setAppliedEmbedUrl("");
    setIsRemovePending(true);
    setLinkDraft("");
    setLinkError(null);
  };

  const applyManualLink = (): void => {
    const normalizedUrl = resolveLessonVideoPreviewUrl({
      savedEmbedUrl: null,
      shouldRemoveVideo: false,
      submittedEmbedUrl: linkDraft,
    });

    if (!normalizedUrl) {
      setLinkError("Informe um link ou iframe válido da JMVStream.");
      return;
    }

    setAppliedEmbedUrl(normalizedUrl);
    setIsRemovePending(false);
    setLinkDraft(normalizedUrl);
    setLinkError(null);
  };

  const removeManualLink = (): void => {
    if (defaultVideoExternalId && defaultEmbedUrl) {
      setAppliedEmbedUrl(defaultEmbedUrl);
      setLinkDraft("");
      setIsRemovePending(false);
      setLinkError(null);
      return;
    }

    removeVideoLocally();
  };

  const applyUploadedPlayerUrl = (playerUrl: string): void => {
    setAppliedEmbedUrl(playerUrl);
    setLinkDraft(playerUrl);
    setIsRemovePending(false);
    setLinkError(null);
  };

  const manualLinkSlot = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative w-full flex-1">
          <HugeiconsIcon
            aria-hidden="true"
            className="absolute top-2.5 left-3 text-muted-foreground"
            icon={Link04Icon}
            size={18}
          />
          <Input
            className="w-full pl-10"
            onChange={(event) => {
              setLinkDraft(event.target.value);
              setLinkError(null);
            }}
            placeholder="Cole o link do YouTube, Vimeo ou JMVStream…"
            value={linkDraft}
          />
        </div>
        <Button
          className="w-full shrink-0 sm:w-auto"
          disabled={!linkDraft.trim()}
          onClick={applyManualLink}
          type="button"
        >
          Aplicar link
        </Button>
      </div>
      {linkError && <p className="text-destructive text-xs">{linkError}</p>}
    </div>
  );

  const manualLinkActiveCard = (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm transition-[opacity,transform] duration-300 ease-out">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <HugeiconsIcon aria-hidden="true" icon={FileLinkIcon} size={20} />
          </div>
          <div className="flex min-w-0 flex-col gap-1 pt-0.5">
            <p className="truncate font-medium text-sm">Link de Vídeo</p>
            <p className="truncate text-muted-foreground text-xs">
              {appliedEmbedUrl}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className=""
                size="sm"
                type="button"
                variant="destructive"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  className="mr-1.5 -ml-0.5"
                  data-icon="inline-start"
                  icon={Delete02Icon}
                  size={14}
                />
                Remover
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-destructive/10 text-destructive">
                  <HugeiconsIcon aria-hidden="true" icon={Delete02Icon} />
                </AlertDialogMedia>
                <AlertDialogTitle>Remover link</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja remover o link deste vídeo? Esta ação
                  não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={removeManualLink}>
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-5 rounded-xl border bg-background p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-base">Vídeo da aula</h3>
          <p className="text-muted-foreground text-sm">
            Associe um vídeo existente ou envie um arquivo para a JMVStream.
          </p>
        </div>
        <a
          className="shrink-0 text-link text-sm underline underline-offset-4"
          href={JMVSTREAM_PORTAL_URL}
          rel="noopener"
          target="_blank"
        >
          Abrir portal JMVStream
        </a>
      </div>

      <input
        defaultValue={defaultVideoDurationSeconds}
        name="durationSeconds"
        type="hidden"
      />
      <input defaultValue={defaultOrder} name="sortOrder" type="hidden" />
      <input
        name="videoEmbedUrl"
        readOnly
        type="hidden"
        value={isRemovePending ? "" : appliedEmbedUrl}
      />
      {isRemovePending ? (
        <input name="removeVideo" type="hidden" value="on" />
      ) : null}

      <input name="videoProvider" type="hidden" value="jmvstream" />

      <JmvstreamUploadPanel
        asset={asset}
        currentVideoHash={defaultVideoExternalId}
        hasManualLinkApplied={hasManualLinkApplied}
        isRemovePending={isRemovePending}
        lessonId={lessonId}
        manualLinkActiveCard={manualLinkActiveCard}
        manualLinkSlot={manualLinkSlot}
        onPlayerReady={applyUploadedPlayerUrl}
        {...(defaultVideoExternalId
          ? { onRemoveVideo: removeVideoLocally }
          : {})}
      />

      <JmvstreamDurationDetector
        defaultEmbedUrl={isRemovePending ? "" : appliedEmbedUrl}
        defaultProvider="jmvstream"
        key={`${isRemovePending ? "removed" : "active"}:${appliedEmbedUrl}`}
        showDetectedMessage={false}
      />

      {previewUrl || isUploadedVideoProcessing ? (
        <div className="pt-4">
          <LessonVideoEditorPreview
            isProcessing={isUploadedVideoProcessing}
            previewUrl={previewUrl}
            title={defaultTitle}
          />
        </div>
      ) : null}
    </div>
  );
}

function getResourceExtension(resource: EditableLessonResource): string | null {
  return getSharedResourceExtension(resource);
}

function getResourceIcon(resource: EditableLessonResource) {
  const extension = getResourceExtension(resource);

  if (resource.storage !== "r2") {
    return FileLinkIcon;
  }
  if (resource.contentType?.startsWith("image/")) {
    return FileImageIcon;
  }
  if (extension === "pdf") {
    return Pdf01Icon;
  }
  if (extension === "zip") {
    return FileArchiveIcon;
  }
  if (
    extension &&
    ["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(extension)
  ) {
    return FileDownloadIcon;
  }

  return File01Icon;
}

function getResourceTone(_resource: EditableLessonResource): string {
  return "bg-muted/50 text-muted-foreground";
}

function AdminResourceVisual({
  lessonId,
  resource,
}: {
  lessonId: string | undefined;
  resource: EditableLessonResource;
}): React.JSX.Element {
  if (resource.storage === "r2" && resource.preview) {
    const backgroundUrl =
      resource.localPreviewUrl ||
      (lessonId
        ? `/api/lessons/${lessonId}/resources/${resource.id}/preview`
        : null);

    if (backgroundUrl) {
      return (
        <div
          aria-label={`Preview de ${resource.label}`}
          className="absolute inset-0 overflow-hidden bg-center bg-cover shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
          role="img"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
          }}
        />
      );
    }
  }

  const Icon = getResourceIcon(resource);
  const tone = getResourceTone(resource);

  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
        tone
      )}
    >
      <HugeiconsIcon aria-hidden="true" icon={Icon} size={22} strokeWidth={2} />
    </div>
  );
}

function formatFileSize(sizeBytes: number): string {
  return formatResourceFileSize(sizeBytes);
}

function getFileTypeLabel(resource: EditableLessonResource): string {
  return getResourceTypeLabel(resource, { presentationLabel: "Apresentação" });
}

function getUploadFilePresentation(file: File) {
  return {
    contentType: file.type,
    fileName: file.name,
    label: file.name,
    sizeBytes: file.size,
    storage: "r2" as const,
  };
}

function getUploadFileIcon(file: File) {
  const presentation = getUploadFilePresentation(file);
  const extension = getSharedResourceExtension(presentation);

  if (file.type.startsWith("image/")) {
    return FileImageIcon;
  }
  if (extension === "pdf") {
    return Pdf01Icon;
  }
  if (extension === "zip") {
    return FileArchiveIcon;
  }
  if (
    extension &&
    ["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(extension)
  ) {
    return FileDownloadIcon;
  }

  return File01Icon;
}

function LessonResourceUploadItem({
  onCancel,
  onDiscard,
  onRetry,
  upload,
}: {
  onCancel: () => void;
  onDiscard: () => void;
  onRetry: () => void;
  upload: LessonResourceUpload;
}): React.JSX.Element {
  const Icon = getUploadFileIcon(upload.file);
  const metadata = `${getResourceTypeLabel(getUploadFilePresentation(upload.file), { presentationLabel: "Apresentação" })} · ${formatResourceFileSize(upload.file.size)}`;
  const isError = upload.status === "error";

  return (
    <ResourceItem
      className={cn(
        "items-start py-2",
        isError && "border-destructive/40 bg-destructive/5"
      )}
    >
      <ResourceItemVisual className="mt-0.5 border-0 bg-muted/40">
        <HugeiconsIcon
          aria-hidden="true"
          className={isError ? "text-destructive" : "text-muted-foreground"}
          icon={isError ? AlertCircleIcon : Icon}
          size={20}
          strokeWidth={2}
        />
      </ResourceItemVisual>

      <ResourceItemContent className="gap-0.5 py-0.5">
        <p className="min-w-0 truncate font-medium text-[13px]">
          {upload.file.name}
        </p>
        <p className="truncate text-muted-foreground text-xs">{metadata}</p>
        {isError ? (
          <p className="break-words text-destructive text-xs" role="alert">
            {upload.error ?? "Não foi possível concluir o upload."}
          </p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-muted-foreground text-xs">
              <span aria-live="polite" role="status">
                {getUploadStatusLabel(upload.phase ?? "preparing")}
              </span>
              {upload.progress?.percentage !== null &&
              upload.progress?.percentage !== undefined &&
              upload.phase === "uploading" ? (
                <span>{upload.progress.percentage}%</span>
              ) : null}
            </div>
            {upload.phase === "uploading" &&
            upload.progress?.percentage !== null &&
            upload.progress?.percentage !== undefined ? (
              <Progress
                aria-label={`Progresso do envio de ${upload.file.name}`}
                className="h-1.5"
                value={upload.progress.percentage}
              />
            ) : null}
          </div>
        )}
      </ResourceItemContent>

      <ResourceItemActions>
        {isError ? (
          <Button
            className="min-h-10 px-2.5"
            onClick={onRetry}
            size="sm"
            type="button"
            variant="outline"
          >
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={RefreshIcon}
              size={14}
            />
            Tentar novamente
          </Button>
        ) : (
          <Button
            aria-label={`Cancelar envio de ${upload.file.name}`}
            className="size-10 text-muted-foreground hover:text-foreground"
            onClick={onCancel}
            size="icon"
            title="Cancelar envio"
            type="button"
            variant="outline"
          >
            <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} size={16} />
          </Button>
        )}
        {isError ? (
          <Button
            aria-label={`Remover upload de ${upload.file.name}`}
            className="size-10 text-muted-foreground hover:text-foreground"
            onClick={onDiscard}
            size="icon"
            title="Remover upload"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={Cancel01Icon}
              size={16}
              strokeWidth={2}
            />
          </Button>
        ) : null}
      </ResourceItemActions>
    </ResourceItem>
  );
}

export function SortableLessonResourceItem({
  formProps,
  lessonId,
  onRemove,
  onEdit,
  resource,
}: {
  resource: EditableLessonResource;
  lessonId?: string | undefined;
  formProps: Record<string, unknown>;
  onRemove: () => void;
  onEdit: () => void;
}) {
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
  } = useSortable({ id: resource.id });

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
  };

  const extension = getResourceExtension(resource);
  const typeLabel = getFileTypeLabel(resource);
  const badgeText = resource.storage === "r2" ? extension : "LINK";

  return (
    <ResourceItem
      dropPlacement={dropPlacement}
      isDragging={isDragging}
      nodeRef={setNodeRef}
      style={style}
    >
      <input
        name="resourceStorage[]"
        type="hidden"
        value={resource.storage}
        {...formProps}
      />
      <input
        name="resourceId[]"
        type="hidden"
        value={resource.id}
        {...formProps}
      />
      {resource.storage === "r2" ? (
        <>
          <input
            name="resourceUrl[]"
            type="hidden"
            value={"url" in resource ? (resource.url as string) : ""}
            {...formProps}
          />
          <input
            name="resourceKey[]"
            type="hidden"
            value={resource.key}
            {...formProps}
          />
          <input
            name="resourceFileName[]"
            type="hidden"
            value={resource.fileName}
            {...formProps}
          />
          <input
            name="resourceContentType[]"
            type="hidden"
            value={resource.contentType}
            {...formProps}
          />
          <input
            name="resourcePreview[]"
            type="hidden"
            value={resource.preview ? JSON.stringify(resource.preview) : ""}
            {...formProps}
          />
          <input
            name="resourceSizeBytes[]"
            type="hidden"
            value={resource.sizeBytes ?? ""}
            {...formProps}
          />
        </>
      ) : (
        <>
          <input name="resourceKey[]" type="hidden" value="" {...formProps} />
          <input
            name="resourceFileName[]"
            type="hidden"
            value=""
            {...formProps}
          />
          <input
            name="resourceContentType[]"
            type="hidden"
            value=""
            {...formProps}
          />
          <input
            name="resourcePreview[]"
            type="hidden"
            value=""
            {...formProps}
          />
          <input
            name="resourceSizeBytes[]"
            type="hidden"
            value=""
            {...formProps}
          />
        </>
      )}

      <input
        name="resourceLabel[]"
        type="hidden"
        value={resource.label}
        {...formProps}
      />
      <input
        name="resourceUrl[]"
        type="hidden"
        value={"url" in resource ? (resource.url as string) : ""}
        {...formProps}
      />

      <ResourceItemDragHandle
        ariaLabel={`Reordenar anexo ${resource.label}`}
        attributes={attributes}
        icon={DragDropVerticalIcon}
        listeners={listeners}
      />
      <ResourceItemVisual>
        <AdminResourceVisual lessonId={lessonId} resource={resource} />
      </ResourceItemVisual>

      <ResourceItemContent>
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 truncate font-medium text-[13px]">
            {resource.label}
          </p>
          {badgeText ? (
            <span className="type-meta shrink-0 rounded-md bg-muted/80 px-1.5 py-0.5 font-semibold text-muted-foreground">
              {badgeText}
            </span>
          ) : null}
        </div>
        {resource.storage === "r2" ? (
          <p className="truncate text-muted-foreground text-xs">
            {typeLabel} &bull; {formatFileSize(resource.sizeBytes ?? 0)}
          </p>
        ) : (
          <p className="truncate text-muted-foreground text-xs">
            {"url" in resource ? resource.url : ""}
          </p>
        )}
      </ResourceItemContent>

      <ResourceItemActions>
        <Button
          aria-label="Editar anexo"
          className="size-11 text-muted-foreground hover:text-foreground sm:size-10"
          onClick={onEdit}
          size="icon"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={PencilEdit01Icon}
            size={16}
            strokeWidth={2}
          />
        </Button>
        <ResourceDeleteAction onDelete={onRemove} />
      </ResourceItemActions>
    </ResourceItem>
  );
}

function ResourceEditModal({
  resource,
  open,
  onClose,
  onUpdate,
}: {
  resource: EditableLessonResource | undefined;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<EditableLessonResource>) => void;
}) {
  const [editLabel, setEditLabel] = useState("");
  const [editUrl, setEditUrl] = useState("");

  useEffect(() => {
    if (resource && open) {
      setEditLabel(resource.label);
      setEditUrl("url" in resource ? (resource.url as string) : "");
    }
  }, [resource, open]);

  if (!resource) {
    return null;
  }

  return (
    <Dialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Anexo</DialogTitle>
          <DialogDescription>
            Altere os detalhes do material anexo a esta aula.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4">
            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm" htmlFor="edit-label">
                Nome do material
              </label>
              <Input
                id="edit-label"
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="Nome do material"
                value={editLabel}
              />
            </div>
            {resource.storage === "external" && (
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm" htmlFor="edit-url">
                  URL do Link
                </label>
                <Input
                  id="edit-url"
                  onBlur={(e) => {
                    const normalized = normalizeExternalUrl(e.target.value);
                    if (normalized) {
                      setEditUrl(normalized);
                    }
                  }}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="https://exemplo.com/material"
                  type="url"
                  value={editUrl}
                />
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onUpdate(resource.id, {
                label: editLabel,
                url: editUrl,
              } as Partial<EditableLessonResource>);
              onClose();
            }}
            type="button"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LessonResourcesFields({
  defaultResources,
  formId,
  lessonId,
}: {
  defaultResources: LessonResource[];
  formId?: string | undefined;
  lessonId?: string | undefined;
}): React.JSX.Element {
  const formProps = formId ? { form: formId } : {};
  const [resources, setResources] = useState(() =>
    defaultResources.length > 0 ? defaultResources.map(toEditableResource) : []
  );

  const [uploadingFiles, setUploadingFiles] = useState<LessonResourceUpload[]>(
    []
  );
  const uploadAbortControllersRef = useRef(new Map<string, AbortController>());
  const objectUrlRegistryRef = useRef<ReturnType<
    typeof createObjectUrlRegistry
  > | null>(null);
  if (!objectUrlRegistryRef.current) {
    objectUrlRegistryRef.current = createObjectUrlRegistry();
  }
  const objectUrlRegistry = objectUrlRegistryRef.current;
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(
    null
  );
  const resourceLimitReached =
    resources.length + uploadingFiles.length >= MAX_LESSON_RESOURCES;

  useEffect(
    () => () => {
      for (const controller of uploadAbortControllersRef.current.values()) {
        controller.abort();
      }
      uploadAbortControllersRef.current.clear();
      objectUrlRegistry.revokeAll();
    },
    [objectUrlRegistry]
  );

  const addResource = (): void => {
    if (resourceLimitReached) {
      toast.error(`Cada aula pode ter até ${MAX_LESSON_RESOURCES} materiais.`);
      return;
    }
    const newResource = createEmptyExternalResource();
    setResources((current) => [...current, newResource]);
    setEditingResourceId(newResource.id);
  };

  const removeResource = (id: string): void => {
    const resource = resources.find((item) => item.id === id);
    if (resource?.storage === "r2" && resource.localPreviewUrl) {
      objectUrlRegistry.revoke(resource.localPreviewUrl);
    }
    setResources((current) => current.filter((resource) => resource.id !== id));
  };

  const updateResource = (
    id: string,
    updates: Partial<EditableLessonResource>
  ): void => {
    setResources((current) =>
      current.map((resource) =>
        resource.id === id
          ? ({ ...resource, ...updates } as EditableLessonResource)
          : resource
      )
    );
  };

  const uploadResource = async (
    file: File,
    uploadId = `temp-${crypto.randomUUID()}`
  ): Promise<void> => {
    if (!lessonId) {
      toast.error("Salve a aula antes de enviar anexos.");
      return;
    }
    const validationMessage = getLessonResourceUploadValidationMessage({
      file,
      resources,
      uploadId,
      uploadingFiles,
    });
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    const abortController = new AbortController();
    uploadAbortControllersRef.current.set(uploadId, abortController);
    setUploadingFiles((current) =>
      upsertLessonResourceUpload(current, file, uploadId)
    );

    try {
      const { preview, reference } = await createAndUploadLessonResource({
        file,
        lessonId,
        onProgress: (progress) => {
          setUploadingFiles((current) =>
            patchLessonResourceUpload(current, uploadId, {
              progress,
            })
          );
        },
        onStatus: (phase) => {
          setUploadingFiles((current) =>
            patchLessonResourceUpload(current, uploadId, {
              phase,
              ...(phase === "retrying" || phase === "uploading"
                ? { progress: undefined }
                : {}),
            })
          );
        },
        signal: abortController.signal,
      });

      const newResource = toEditableResource(reference);
      if (newResource.storage === "r2" && preview) {
        newResource.localPreviewUrl = objectUrlRegistry.create(preview.blob);
      }

      setResources((current) => [...current, newResource]);
      setEditingResourceId(newResource.id);
      setUploadingFiles((current) =>
        removeLessonResourceUpload(current, uploadId)
      );
      toast.success("Anexo enviado. Salve a aula para publicar o material.");
    } catch (error) {
      handleLessonResourceUploadFailure({
        error,
        signal: abortController.signal,
        uploadId,
        setUploadingFiles,
      });
    } finally {
      if (uploadAbortControllersRef.current.get(uploadId) === abortController) {
        uploadAbortControllersRef.current.delete(uploadId);
      }
    }
  };

  const cancelUpload = (uploadId: string): void => {
    uploadAbortControllersRef.current.get(uploadId)?.abort();
  };

  const discardUpload = (uploadId: string): void => {
    setUploadingFiles((current) =>
      removeLessonResourceUpload(current, uploadId)
    );
  };

  const sensors = useSortableSensors();
  const accessibility = createSortableAccessibility((id) => {
    const resource = resources.find((item) => item.id === id);
    return resource ? `anexo ${resource.label || "sem nome"}` : `anexo ${id}`;
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setResources((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleFileDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setIsFileDragActive(true);
  };

  const handleFileDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    setIsFileDragActive(false);
  };

  const handleFileDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setIsFileDragActive(true);
  };

  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setIsFileDragActive(false);
    const file = event.dataTransfer.files.item(0);
    if (file) {
      uploadResource(file).catch(() => undefined);
    }
  };

  return (
    <ResourceListContainer
      className={isFileDragActive ? "border-primary bg-primary/5" : ""}
      onDragEnter={handleFileDragEnter}
      onDragLeave={handleFileDragLeave}
      onDragOver={handleFileDragOver}
      onDrop={handleFileDrop}
    >
      <input
        {...formProps}
        name="resourceUploadPending"
        type="hidden"
        value={
          uploadingFiles.some((upload) => upload.status === "uploading")
            ? "on"
            : ""
        }
      />
      <ResourceEditModal
        onClose={() => setEditingResourceId(null)}
        onUpdate={updateResource}
        open={!!editingResourceId}
        resource={resources.find(
          (resource) => resource.id === editingResourceId
        )}
      />
      <ResourceListHeader
        actions={
          <>
            <label
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "h-8 cursor-pointer px-3 focus-within:border-focus focus-within:outline-2 focus-within:outline-focus focus-within:outline-offset-2 focus-within:ring-2 focus-within:ring-background data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
              )}
              data-disabled={resourceLimitReached}
            >
              <input
                accept={LESSON_ATTACHMENT_ACCEPT}
                className="sr-only"
                disabled={resourceLimitReached}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) {
                    uploadResource(file).catch(() => undefined);
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
              Upload
            </label>
            <Button
              className="h-8 px-3"
              disabled={resourceLimitReached}
              onClick={addResource}
              size="sm"
              type="button"
              variant="outline"
            >
              <HugeiconsIcon
                aria-hidden="true"
                className="-ms-0.5 mr-1.5 opacity-60"
                icon={Add01Icon}
                size={14}
              />
              Link
            </Button>
          </>
        }
        count={resources.length}
        description={`PDF, imagens e documentos · até ${Math.round(MAX_LESSON_ATTACHMENT_BYTES / (1024 * 1024))} MiB por arquivo · ${MAX_LESSON_RESOURCES} itens e ${Math.round(MAX_LESSON_R2_RESOURCES_BYTES / (1024 * 1024))} MiB por aula. A ordem é salva junto com a aula.`}
        title="Anexos"
      />

      {resources.length > 0 || uploadingFiles.length > 0 ? (
        <ResourceListBody>
          <DndContext
            accessibility={accessibility}
            collisionDetection={closestCenter}
            id="lesson-resources-dnd"
            onDragEnd={handleDragEnd}
            sensors={sensors}
          >
            <SortableContext
              items={resources}
              strategy={verticalListSortingStrategy}
            >
              {resources.map((resource) => (
                <SortableLessonResourceItem
                  formProps={formProps}
                  key={resource.id}
                  lessonId={lessonId}
                  onEdit={() => setEditingResourceId(resource.id)}
                  onRemove={() => removeResource(resource.id)}
                  resource={resource}
                />
              ))}
            </SortableContext>
          </DndContext>
          {uploadingFiles.map((upload) => (
            <LessonResourceUploadItem
              key={upload.id}
              onCancel={() => cancelUpload(upload.id)}
              onDiscard={() => discardUpload(upload.id)}
              onRetry={() => {
                uploadResource(upload.file, upload.id).catch(() => undefined);
              }}
              upload={upload}
            />
          ))}
        </ResourceListBody>
      ) : (
        <ResourceDropzoneEmpty
          description="Ou use o botão Upload acima."
          title="Arraste um arquivo aqui"
        />
      )}
    </ResourceListContainer>
  );
}

type EditableLessonResource =
  | {
      id: string;
      label: string;
      storage: "external";
      url: string;
    }
  | {
      contentType: string;
      fileName: string;
      id: string;
      key: string;
      label: string;
      preview?: {
        contentType: "image/webp";
        height: number;
        key: string;
        sizeBytes: number;
        width: number;
      };
      sizeBytes: number;
      storage: "r2";
      localPreviewUrl?: string;
    };

interface LessonResourceUpload {
  error?: string;
  file: File;
  id: string;
  phase?: UploadStatusPhase;
  progress?: UploadTransferProgress | null | undefined;
  status: "error" | "uploading";
}

const getLessonResourceUploadValidationMessage = ({
  file,
  resources,
  uploadId,
  uploadingFiles,
}: {
  file: File;
  resources: EditableLessonResource[];
  uploadId: string;
  uploadingFiles: LessonResourceUpload[];
}): string | null => {
  try {
    validateLessonAttachmentUpload({
      contentType: file.type,
      fileName: file.name,
      sizeBytes: file.size,
    });
  } catch (error) {
    return error instanceof Error ? error.message : "Arquivo não permitido.";
  }

  const isRetryingExistingUpload = uploadingFiles.some(
    (upload) => upload.id === uploadId
  );
  if (
    !isRetryingExistingUpload &&
    resources.length + uploadingFiles.length >= MAX_LESSON_RESOURCES
  ) {
    return `Cada aula pode ter até ${MAX_LESSON_RESOURCES} materiais.`;
  }

  const storedBytes = resources.reduce(
    (total, resource) =>
      resource.storage === "r2" ? total + resource.sizeBytes : total,
    0
  );
  const pendingBytes = uploadingFiles.reduce(
    (total, upload) =>
      upload.id === uploadId ? total : total + upload.file.size,
    0
  );
  if (storedBytes + pendingBytes + file.size > MAX_LESSON_R2_RESOURCES_BYTES) {
    return "O total de arquivos da aula não pode exceder 750 MiB.";
  }

  return null;
};

const upsertLessonResourceUpload = (
  current: LessonResourceUpload[],
  file: File,
  id: string
): LessonResourceUpload[] => {
  if (current.some((upload) => upload.id === id)) {
    return current.map((upload) =>
      upload.id === id
        ? {
            file: upload.file,
            id: upload.id,
            phase: "preparing",
            progress: null,
            status: "uploading",
          }
        : upload
    );
  }

  return [...current, { file, id, phase: "preparing", status: "uploading" }];
};

const patchLessonResourceUpload = (
  current: LessonResourceUpload[],
  id: string,
  patch: Partial<LessonResourceUpload>
): LessonResourceUpload[] =>
  current.map((upload) =>
    upload.id === id ? { ...upload, ...patch } : upload
  );

const removeLessonResourceUpload = (
  current: LessonResourceUpload[],
  id: string
): LessonResourceUpload[] => current.filter((upload) => upload.id !== id);

const handleLessonResourceUploadFailure = ({
  error,
  setUploadingFiles,
  signal,
  uploadId,
}: {
  error: unknown;
  setUploadingFiles: React.Dispatch<
    React.SetStateAction<LessonResourceUpload[]>
  >;
  signal: AbortSignal;
  uploadId: string;
}): void => {
  if (isUploadAbortedError(error, signal)) {
    setUploadingFiles((current) =>
      removeLessonResourceUpload(current, uploadId)
    );
    return;
  }

  const message =
    error instanceof Error ? error.message : "Não foi possível enviar.";
  setUploadingFiles((current) =>
    patchLessonResourceUpload(current, uploadId, {
      error: message,
      status: "error",
    })
  );
};

const createAndUploadLessonResource = async ({
  file,
  lessonId,
  onProgress,
  onStatus,
  signal,
}: {
  file: File;
  lessonId: string;
  onProgress: (progress: UploadTransferProgress) => void;
  onStatus: (phase: UploadStatusPhase) => void;
  signal: AbortSignal;
}): Promise<{
  preview: LessonResourceUploadPreview | null;
  reference: LessonResourceUploadReference;
}> => {
  const preview = await createImagePreview(file, signal);
  if (signal.aborted) {
    throw new UploadAbortedError();
  }

  const reference = await uploadLessonResource({
    file,
    lessonId,
    onProgress,
    onStatus,
    preview,
    signal,
  });
  return { preview, reference };
};

const createEmptyExternalResource = (): EditableLessonResource => ({
  id: `resource-${crypto.randomUUID()}`,
  label: "",
  storage: "external",
  url: "",
});

const toEditableResource = (
  resource: LessonResource
): EditableLessonResource =>
  resource.storage === "r2"
    ? resource
    : {
        id: resource.id,
        label: resource.label,
        storage: "external",
        url: resource.url,
      };

const whitespacePattern = /\s/;

const normalizeExternalUrl = (value: string): string | null => {
  const trimmed = value.trim();

  if (!trimmed || trimmed.includes("\n") || whitespacePattern.test(trimmed)) {
    return null;
  }

  try {
    const url = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`
    );

    if (!(url.protocol === "http:" || url.protocol === "https:")) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
};

const imagePreviewTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const createImagePreview = async (
  file: File,
  signal?: AbortSignal
): Promise<LessonResourceUploadPreview | null> => {
  if (!imagePreviewTypes.has(file.type)) {
    return null;
  }

  const image = await readImage(file, signal);
  if (signal?.aborted) {
    throw new UploadAbortedError();
  }
  const { height, width } = LESSON_RESOURCE_IMAGE_PREVIEW;
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  const sourceWidth =
    sourceRatio > targetRatio
      ? image.naturalHeight * targetRatio
      : image.naturalWidth;
  const sourceHeight =
    sourceRatio > targetRatio
      ? image.naturalHeight
      : image.naturalWidth / targetRatio;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas indisponível para gerar a prévia.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height
  );

  const blob = await canvasToBlob(canvas);
  if (signal?.aborted) {
    throw new UploadAbortedError();
  }

  return {
    blob,
    contentType: "image/webp",
    height,
    width,
  };
};

const readImage = async (
  file: File,
  signal?: AbortSignal
): Promise<HTMLImageElement> =>
  await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    let settled = false;
    const cleanup = (): void => {
      signal?.removeEventListener("abort", abort);
      image.onload = null;
      image.onerror = null;
      URL.revokeObjectURL(url);
    };
    const finish = (error?: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      if (error) {
        reject(error);
      } else {
        resolve(image);
      }
    };
    const abort = (): void => {
      image.src = "";
      finish(new UploadAbortedError());
    };

    if (signal?.aborted) {
      finish(new UploadAbortedError());
      return;
    }
    image.onload = () => finish();
    image.onerror = () => finish(new Error("Não foi possível ler a imagem."));
    signal?.addEventListener("abort", abort, { once: true });
    image.src = url;
  });

const canvasToBlob = async (canvas: HTMLCanvasElement): Promise<Blob> =>
  await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Não foi possível gerar a prévia."));
      },
      "image/webp",
      0.78
    );
  });
