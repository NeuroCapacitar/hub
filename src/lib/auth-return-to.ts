const COURSE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PURCHASE_PATH_PREFIX = "/comprar/";
const MAX_AUTH_RETURN_TO_LENGTH = 256;
const AUTH_REDIRECT_ORIGIN = "https://hub.invalid";

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

export const getAuthSignInPath = (returnTo: unknown): string => {
  const safeReturnTo = getSafeAuthReturnTo(returnTo);
  if (!safeReturnTo) {
    return "/entrar";
  }

  return `/entrar?${new URLSearchParams({ returnTo: safeReturnTo }).toString()}`;
};

const createApplicationUrl = (path: string, appUrl: string): URL => {
  const configuredUrl = new URL(appUrl);
  if (
    !(
      configuredUrl.protocol === "http:" || configuredUrl.protocol === "https:"
    ) ||
    configuredUrl.username ||
    configuredUrl.password
  ) {
    throw new Error("A valid application URL is required for authentication.");
  }

  return new URL(path, configuredUrl.origin);
};

export const getGoogleOAuthCallbackUrl = ({
  appUrl,
  returnTo,
}: {
  appUrl: string;
  returnTo: unknown;
}): string => {
  const callbackUrl = createApplicationUrl("/oauth/callback", appUrl);
  const safeReturnTo = getSafeAuthReturnTo(returnTo);
  if (safeReturnTo) {
    callbackUrl.searchParams.set("returnTo", safeReturnTo);
  }

  return callbackUrl.toString();
};

export const getEmailVerificationCallbackUrl = ({
  appUrl,
  returnTo,
}: {
  appUrl: string;
  returnTo: unknown;
}): string => {
  const callbackUrl = createApplicationUrl("/entrar", appUrl);
  callbackUrl.searchParams.set("emailVerified", "1");
  const safeReturnTo = getSafeAuthReturnTo(returnTo);
  if (safeReturnTo) {
    callbackUrl.searchParams.set("returnTo", safeReturnTo);
  }

  return callbackUrl.toString();
};

export const getSafeAuthRedirectPath = (value: unknown): string | null => {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    hasControlCharacter(value)
  ) {
    return null;
  }

  try {
    const redirectUrl = new URL(value, AUTH_REDIRECT_ORIGIN);
    if (redirectUrl.origin !== AUTH_REDIRECT_ORIGIN) {
      return null;
    }

    return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
  } catch {
    return null;
  }
};
