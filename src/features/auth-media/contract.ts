export const AUTH_MEDIA_MAX_SLIDES = 5;
export const AUTH_MEDIA_PUBLIC_PREFIX = "auth-media/";

const AUTH_MEDIA_SLIDE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isAuthMediaSlideId = (value: string): boolean =>
  AUTH_MEDIA_SLIDE_ID_PATTERN.test(value);

export const buildAuthMediaObjectKey = (
  slideId: string,
  versionId: string
): string => {
  if (!(isAuthMediaSlideId(slideId) && isAuthMediaSlideId(versionId))) {
    throw new Error("Identificador da mídia da tela de acesso inválido.");
  }

  return `${AUTH_MEDIA_PUBLIC_PREFIX}${slideId}/${versionId}.webp`;
};

export const isAuthMediaObjectKey = (value: string): boolean => {
  if (
    !(value.startsWith(AUTH_MEDIA_PUBLIC_PREFIX) && value.endsWith(".webp"))
  ) {
    return false;
  }

  const segments = value
    .slice(AUTH_MEDIA_PUBLIC_PREFIX.length, -".webp".length)
    .split("/");
  return (
    segments.length === 2 &&
    segments.every((segment) => isAuthMediaSlideId(segment))
  );
};
