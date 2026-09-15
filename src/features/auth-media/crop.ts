import {
  AUTH_MEDIA_IMAGE_HEIGHT,
  AUTH_MEDIA_IMAGE_WIDTH,
} from "@/features/storage/auth-media-image-contract";

const FILE_EXTENSION_PATTERN = /\.[^.]+$/;

export interface AuthMediaCropArea {
  height: number;
  width: number;
  x: number;
  y: number;
}

const loadImage = (sourceUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("error", () =>
      reject(new Error("Não foi possível abrir a imagem."))
    );
    image.addEventListener("load", () => resolve(image));
    image.src = sourceUrl;
  });

export const getAuthMediaCropOutputName = (originalName: string): string => {
  const baseName =
    originalName.trim().replace(FILE_EXTENSION_PATTERN, "") || "imagem";

  return `${baseName}-acesso.webp`;
};

export const createAuthMediaCropFile = async ({
  crop,
  originalName,
  sourceUrl,
}: {
  crop: AuthMediaCropArea;
  originalName: string;
  sourceUrl: string;
}): Promise<File> => {
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Não foi possível preparar o recorte da imagem.");
  }

  canvas.width = AUTH_MEDIA_IMAGE_WIDTH;
  canvas.height = AUTH_MEDIA_IMAGE_HEIGHT;
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    AUTH_MEDIA_IMAGE_WIDTH,
    AUTH_MEDIA_IMAGE_HEIGHT
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }
        reject(new Error("Não foi possível gerar a imagem em WebP."));
      },
      "image/webp",
      0.92
    );
  });

  return new File([blob], getAuthMediaCropOutputName(originalName), {
    type: "image/webp",
  });
};
