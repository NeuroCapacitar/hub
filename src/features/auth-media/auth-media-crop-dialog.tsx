"use client";

import {
  CropIcon,
  ZoomInAreaIcon,
  ZoomOutAreaIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  AUTH_MEDIA_IMAGE_ASPECT_RATIO,
  validateAuthMediaSourceRequest,
} from "@/features/storage/auth-media-image-contract";
import { type AuthMediaCropArea, createAuthMediaCropFile } from "./crop";

interface AuthMediaCropDialogProps {
  file: File | null;
  onCancel: () => void;
  onComplete: (file: File) => void;
}

const toAuthMediaCropArea = (area: Area): AuthMediaCropArea => ({
  height: area.height,
  width: area.width,
  x: area.x,
  y: area.y,
});

export function AuthMediaCropDialog({
  file,
  onCancel,
  onComplete,
}: AuthMediaCropDialogProps): React.JSX.Element {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [cropPixels, setCropPixels] = useState<AuthMediaCropArea | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!file) {
      setSourceUrl(null);
      setCropPixels(null);
      setZoom(1);
      return;
    }

    const nextSourceUrl = URL.createObjectURL(file);
    setSourceUrl(nextSourceUrl);
    setCrop({ x: 0, y: 0 });
    setCropPixels(null);
    setZoom(1);

    return () => URL.revokeObjectURL(nextSourceUrl);
  }, [file]);

  const handleComplete = async (): Promise<void> => {
    if (!(file && sourceUrl && cropPixels)) {
      return;
    }

    setIsPreparing(true);
    try {
      const croppedFile = await createAuthMediaCropFile({
        crop: cropPixels,
        originalName: file.name,
        sourceUrl,
      });
      validateAuthMediaSourceRequest({
        contentType: croppedFile.type,
        sizeBytes: croppedFile.size,
      });
      onComplete(croppedFile);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar a imagem."
      );
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <Dialog onOpenChange={(open) => !open && onCancel()} open={file !== null}>
      <DialogContent className="max-w-4xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Ajustar imagem da tela de acesso</DialogTitle>
          <p className="text-muted-foreground text-sm">
            Arraste e use o zoom para definir o enquadramento 8:7.
          </p>
        </DialogHeader>

        <DialogBody className="space-y-6 p-4 sm:p-6">
          {sourceUrl ? (
            <div className="relative mx-auto h-96 max-h-[60vh] overflow-hidden rounded-2xl border border-border/60 bg-muted/30 shadow-inner sm:h-120">
              <Cropper
                aspect={AUTH_MEDIA_IMAGE_ASPECT_RATIO}
                crop={crop}
                image={sourceUrl}
                onCropChange={setCrop}
                onCropComplete={(_, area) =>
                  setCropPixels(toAuthMediaCropArea(area))
                }
                onZoomChange={setZoom}
                showGrid
                zoom={zoom}
              />
            </div>
          ) : null}

          <div className="mx-auto flex w-full max-w-md items-center gap-4">
            <HugeiconsIcon
              aria-hidden="true"
              className="shrink-0 text-muted-foreground"
              icon={ZoomOutAreaIcon}
              size={18}
            />
            <Slider
              aria-label="Zoom da imagem"
              className="flex-1"
              max={3}
              min={1}
              onValueChange={(values) => setZoom(values[0] ?? 1)}
              step={0.05}
              value={[zoom]}
            />
            <HugeiconsIcon
              aria-hidden="true"
              className="shrink-0 text-muted-foreground"
              icon={ZoomInAreaIcon}
              size={18}
            />
          </div>
        </DialogBody>

        <DialogFooter className="items-center sm:justify-end">
          <div className="flex w-full justify-end gap-3 sm:w-auto">
            <Button
              disabled={isPreparing}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={!cropPixels || isPreparing}
              loading={isPreparing}
              onClick={handleComplete}
              type="button"
            >
              <HugeiconsIcon
                aria-hidden="true"
                className="mr-2"
                data-icon="inline-start"
                icon={CropIcon}
                size={16}
              />
              Confirmar recorte
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
