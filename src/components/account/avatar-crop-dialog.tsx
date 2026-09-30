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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  createUserAvatarCropFile,
  type UserAvatarCropArea,
} from "@/features/account/avatar-crop";
import { USER_AVATAR_MAX_BYTES } from "@/features/account/avatar-policy";

const toUserAvatarCropArea = (area: Area): UserAvatarCropArea => ({
  height: area.height,
  width: area.width,
  x: area.x,
  y: area.y,
});

export function AvatarCropDialog({
  file,
  onCancel,
  onComplete,
}: {
  file: File | null;
  onCancel: () => void;
  onComplete: (file: File) => void | Promise<void>;
}): React.JSX.Element {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [cropPixels, setCropPixels] = useState<UserAvatarCropArea | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!file) {
      setCropPixels(null);
      setSourceUrl(null);
      setZoom(1);
      return;
    }

    const nextSourceUrl = URL.createObjectURL(file);
    setCrop({ x: 0, y: 0 });
    setCropPixels(null);
    setSourceUrl(nextSourceUrl);
    setZoom(1);

    return () => URL.revokeObjectURL(nextSourceUrl);
  }, [file]);

  const handleComplete = async (): Promise<void> => {
    if (!(file && cropPixels && sourceUrl)) {
      return;
    }

    setIsPreparing(true);
    try {
      const croppedFile = await createUserAvatarCropFile({
        crop: cropPixels,
        sourceUrl,
      });
      if (croppedFile.size > USER_AVATAR_MAX_BYTES) {
        throw new Error("A imagem preparada ultrapassa o limite de 5 MiB.");
      }
      await onComplete(croppedFile);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar a foto."
      );
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!(open || isPreparing)) {
          onCancel();
        }
      }}
      open={file !== null}
    >
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Ajustar foto de perfil</DialogTitle>
          <DialogDescription>
            Arraste para escolher o enquadramento quadrado e ajuste o zoom.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-5 p-4 sm:p-6">
          {sourceUrl ? (
            <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl border border-border/60 bg-muted/30">
              <Cropper
                aspect={1}
                crop={crop}
                image={sourceUrl}
                onCropChange={setCrop}
                onCropComplete={(_, area) =>
                  setCropPixels(toUserAvatarCropArea(area))
                }
                onZoomChange={setZoom}
                showGrid
                zoom={zoom}
              />
            </div>
          ) : null}

          <div className="mx-auto flex w-full max-w-sm items-center gap-4">
            <HugeiconsIcon
              aria-hidden="true"
              className="shrink-0 text-muted-foreground"
              icon={ZoomOutAreaIcon}
              size={18}
            />
            <Slider
              aria-label="Zoom da foto de perfil"
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
              Usar esta foto
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
