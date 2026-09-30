import { USER_AVATAR_SIZE } from "./avatar-policy";

export interface UserAvatarCropArea {
  height: number;
  width: number;
  x: number;
  y: number;
}

const loadImage = (sourceUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("error", () =>
      reject(new Error("Não foi possível abrir esta imagem."))
    );
    image.addEventListener("load", () => resolve(image));
    image.src = sourceUrl;
  });

export const createUserAvatarCropFile = async ({
  crop,
  sourceUrl,
}: {
  crop: UserAvatarCropArea;
  sourceUrl: string;
}): Promise<File> => {
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Não foi possível preparar o recorte da foto.");
  }

  canvas.width = USER_AVATAR_SIZE;
  canvas.height = USER_AVATAR_SIZE;
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    USER_AVATAR_SIZE,
    USER_AVATAR_SIZE
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }
        reject(new Error("Não foi possível preparar a foto em WebP."));
      },
      "image/webp",
      0.9
    );
  });

  const outputType = blob.type;
  if (outputType !== "image/webp" && outputType !== "image/png") {
    throw new Error("Não foi possível preparar a foto neste navegador.");
  }
  const extension = outputType === "image/webp" ? "webp" : "png";

  return new File([blob], `profile-avatar.${extension}`, { type: outputType });
};
