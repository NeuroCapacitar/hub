import { AUTH_MEDIA_PUBLIC_PREFIX } from "@/features/auth-media/contract";

const PUBLIC_MEDIA_PREFIXES = [
  AUTH_MEDIA_PUBLIC_PREFIX,
  "banners/",
  "courses/",
] as const;
const TRAILING_SLASH_PATTERN = /\/$/;
const SAFE_PUBLIC_SEGMENT = /^[A-Za-z0-9_.-]+$/;

const isPublicMediaKey = (key: string): boolean =>
  PUBLIC_MEDIA_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
  key
    .split("/")
    .every(
      (segment) =>
        SAFE_PUBLIC_SEGMENT.test(segment) && segment !== "." && segment !== ".."
    );

export const assertPublicMediaKey = (key: string): void => {
  if (!isPublicMediaKey(key)) {
    throw new Error("Chave de mídia pública inválida.");
  }
};

export const buildPublicMediaUrl = ({
  baseUrl,
  key,
  physicalKey = key,
}: {
  baseUrl: string;
  key: string;
  physicalKey?: string;
}): string => {
  assertPublicMediaKey(key);

  return new URL(
    physicalKey,
    `${baseUrl.replace(TRAILING_SLASH_PATTERN, "")}/`
  ).toString();
};
