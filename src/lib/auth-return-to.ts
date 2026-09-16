const COURSE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PURCHASE_PATH_PREFIX = "/comprar/";
const MAX_AUTH_RETURN_TO_LENGTH = 256;

const hasControlCharacter = (value: string): boolean => {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)) {
      return true;
    }
  }

  return false;
};

export const getSafeAuthReturnTo = (value: unknown): string | null => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_AUTH_RETURN_TO_LENGTH
  ) {
    return null;
  }

  if (
    hasControlCharacter(value) ||
    value.includes("\\") ||
    value.includes("?") ||
    value.includes("#") ||
    value.includes("%")
  ) {
    return null;
  }

  if (!value.startsWith(PURCHASE_PATH_PREFIX)) {
    return null;
  }

  const slug = value.slice(PURCHASE_PATH_PREFIX.length);
  return COURSE_SLUG_PATTERN.test(slug) ? value : null;
};
