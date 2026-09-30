export type SignInOutcome =
  | "authenticated"
  | "email_verification_required"
  | "failure";

export const getSignInOutcome = (payload: unknown): SignInOutcome => {
  if (typeof payload !== "object" || payload === null) {
    return "failure";
  }

  const data = payload as {
    code?: unknown;
    error?: unknown;
    message?: unknown;
    user?: unknown;
  };

  if (data.code === "EMAIL_NOT_VERIFIED") {
    return "email_verification_required";
  }

  if (data.code || data.error) {
    return "failure";
  }

  return typeof data.user === "object" && data.user !== null
    ? "authenticated"
    : "failure";
};

export const isSuccessfulSignInPayload = (payload: unknown): boolean =>
  getSignInOutcome(payload) === "authenticated";
