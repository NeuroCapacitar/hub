import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthShell } from "@/components/auth-shell";
import { resolvePostAuthRedirect } from "@/lib/auth-redirect";
import {
  getAuthSignInPath,
  getEmailVerificationCallbackUrl,
  getSafeAuthReturnTo,
} from "@/lib/auth-return-to";
import { getServerEnv } from "@/lib/env";
import { createCorrelationId, logOperationalEvent } from "@/lib/observability";
import {
  type AppSession,
  getCurrentSession,
  recordLastAccess,
} from "@/lib/session";
import { GoogleOAuthCallbackClient } from "./oauth-callback-client";

export const metadata: Metadata = {
  title: "Concluindo acesso",
};
export const dynamic = "force-dynamic";

const VOLUNTARY_CANCELLATION_ERRORS = new Set([
  "access_denied",
  "user_cancelled",
]);

const hasQueryValue = (value: string | string[] | undefined): boolean =>
  typeof value === "string"
    ? value.length > 0
    : Array.isArray(value) && value.length > 0;

export default async function GoogleOAuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[] | undefined;
    error_description?: string | string[] | undefined;
    returnTo?: string | string[] | undefined;
  }>;
}): Promise<React.JSX.Element> {
  await connection();
  const params = await searchParams;
  const safeReturnTo = getSafeAuthReturnTo(params.returnTo);
  const providerError = typeof params.error === "string" ? params.error : null;
  const hasProviderError =
    hasQueryValue(params.error) || hasQueryValue(params.error_description);

  if (providerError && VOLUNTARY_CANCELLATION_ERRORS.has(providerError)) {
    redirect(getAuthSignInPath(safeReturnTo));
  }

  if (!hasProviderError) {
    let session: AppSession | null = null;
    try {
      session = await getCurrentSession();
    } catch {
      logOperationalEvent({
        correlationId: createCorrelationId(null),
        errorCode: "oauth_callback_session_resolution_failed",
        operation: "auth.oauth_callback",
        outcome: "failure",
        provider: "database",
      });
    }

    if (session) {
      const resolution = resolvePostAuthRedirect(session, safeReturnTo);
      if (resolution.kind === "redirect") {
        try {
          await recordLastAccess(session.user.id);
        } catch {
          logOperationalEvent({
            correlationId: createCorrelationId(null),
            errorCode: "last_access_update_failed",
            operation: "auth.last_access",
            outcome: "failure",
            provider: "database",
          });
        }

        redirect(resolution.destination);
      }
    }
  }

  const env = await getServerEnv();
  const verificationCallbackUrl = getEmailVerificationCallbackUrl({
    appUrl: env.BETTER_AUTH_URL,
    returnTo: safeReturnTo,
  });

  return (
    <AuthShell formSide="right">
      <GoogleOAuthCallbackClient
        hasProviderError={hasProviderError}
        returnTo={safeReturnTo}
        supportEmail={env.SUPPORT_EMAIL ?? null}
        verificationCallbackUrl={verificationCallbackUrl}
      />
    </AuthShell>
  );
}
