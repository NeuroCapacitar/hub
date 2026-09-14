export const AUTH_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const AUTH_MEDIA_IMAGE_WIDTH = 1200;
export const AUTH_MEDIA_IMAGE_HEIGHT = 1050;
export const AUTH_MEDIA_IMAGE_ASPECT_RATIO =
  AUTH_MEDIA_IMAGE_WIDTH / AUTH_MEDIA_IMAGE_HEIGHT;
export const AUTH_MEDIA_ACCEPT = ".jpeg,.jpg,.png,.webp";

const AUTH_MEDIA_SOURCE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const validateAuthMediaSourceRequest = ({
  contentType,
  sizeBytes,
}: {
  contentType: string;
  sizeBytes: number;
}): void => {
  if (!AUTH_MEDIA_SOURCE_CONTENT_TYPES.has(contentType)) {
    throw new Error("Formato de imagem não suportado para a tela de acesso.");
  }

  if (!(Number.isInteger(sizeBytes) && sizeBytes > 0)) {
    throw new Error("Tamanho de arquivo inválido.");
  }

  if (sizeBytes > AUTH_MEDIA_MAX_BYTES) {
    throw new Error("A imagem não pode ter mais de 5 MiB.");
  }
};
