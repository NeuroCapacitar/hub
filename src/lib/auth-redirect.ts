import { getAdminLandingPath } from "@/lib/auth-policy";
import { getSafeAuthReturnTo } from "@/lib/auth-return-to";
import type { AppSession } from "@/lib/session";

export type PostAuthRedirect =
  | { kind: "blocked" }
  | { destination: string; kind: "redirect" };

export const resolvePostAuthRedirect = (
  session: AppSession,
  returnTo: unknown
): PostAuthRedirect => {
  if (session.role === "student" && session.platformBlockedAt) {
    return { kind: "blocked" };
  }

  if (session.role === "student") {
    return {
      destination: getSafeAuthReturnTo(returnTo) ?? "/app",
      kind: "redirect",
    };
  }

  return {
    destination: getAdminLandingPath(session) ?? "/app",
    kind: "redirect",
  };
};
