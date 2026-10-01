import { requestAccountEmailVerificationByAddress } from "@/features/account/email-challenges";
import { withAccountPasswordResetOperation } from "@/features/account/password-reset-operations";
import { scheduleOutboxDrainAfterResponse } from "@/features/outbox/background-drain";
import { getAuth, isStudentPlatformAccessBlocked } from "@/lib/auth";
import { isBlockedAuthEndpoint } from "@/lib/auth-policy";
import { getServerEnv } from "@/lib/env";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
  logOperationalEvent,
} from "@/lib/observability";

interface AuthRouteContext {
  params: Promise<{ all?: string[] }>;
}

interface SocialAuthRequest {
  provider: string | null;
  requestSignUp: boolean;
}

const AUTH_API_PATH_PREFIX_PATTERN = /^\/api\/auth\/?/;
const TRAILING_SLASH_PATTERN = /\/$/;

const getSocialAuthRequest = async (
  request: Request
): Promise<SocialAuthRequest> => {
  try {
    const body: unknown = await request.clone().json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { provider: null, requestSignUp: false };
    }

    const provider = Reflect.get(body, "provider");
    return {
      provider: typeof provider === "string" ? provider : null,
      requestSignUp: Reflect.get(body, "requestSignUp") === true,
    };
  } catch {
    return { provider: null, requestSignUp: false };
  }
};

const isResponseFailure = async (response: Response): Promise<boolean> => {
  if (response.status >= 400) {
    return true;
  }

  try {
    const body: unknown = await response.clone().json();
    return Boolean(
      body &&
        typeof body === "object" &&
        (Reflect.get(body, "error") || Reflect.get(body, "status") === false)
    );
  } catch {
    return false;
  }
};

const verificationEmailResponse = (): Response =>
  Response.json({ status: true }, { headers: { "cache-control": "no-store" } });

const blockedAccountResponse = (): Response =>
  Response.json(
    { code: "ACCOUNT_SUSPENDED", error: "account_suspended" },
    { headers: { "cache-control": "no-store" }, status: 403 }
  );

const recoveryEndpoints = new Set([
  "request-password-reset",
  "reset-password",
  "sign-out",
]);

const isPublicAccountRecoveryEndpoint = (authEndpoint: string): boolean =>
  recoveryEndpoints.has(authEndpoint) ||
  authEndpoint.startsWith("reset-password/");

const checkAuthenticatedPlatformAccess = async (
  request: Request,
  authEndpoint: string
): Promise<Response | null> => {
  if (
    isPublicAccountRecoveryEndpoint(authEndpoint) ||
    !request.headers.has("cookie")
  ) {
    return null;
  }

  const session = await getAuth().api.getSession({ headers: request.headers });
  if (
    session?.user &&
    (await isStudentPlatformAccessBlocked(session.user.id))
  ) {
    return blockedAccountResponse();
  }
  return null;
};

const handleVerificationEmailRequest = async (
  request: Request,
  correlationId: string
): Promise<Response> => {
  try {
    const body: unknown = await request.clone().json();
    if (
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      typeof Reflect.get(body, "email") === "string"
    ) {
      const outcome = await requestAccountEmailVerificationByAddress({
        email: Reflect.get(body, "email"),
        requestHeaders: request.headers,
      });
      if (outcome === "queued") {
        try {
          scheduleOutboxDrainAfterResponse({ correlationId });
        } catch {
          logOperationalEvent({
            correlationId,
            errorCode: "account_verification_drain_schedule_failed",
            operation: "auth.email_verification_drain",
            outcome: "failure",
          });
        }
      }
    }
  } catch {
    logOperationalEvent({
      correlationId,
      errorCode: "verification_email_request_failed",
      operation: "auth.email_verification_request",
      outcome: "failure",
      provider: "database",
    });
  }

  return verificationEmailResponse();
};

const logAuthRequestOutcome = async ({
  authEndpoint,
  correlationId,
  response,
  socialAuthRequest,
}: {
  authEndpoint: string;
  correlationId: string;
  response: Response;
  socialAuthRequest: SocialAuthRequest;
}): Promise<void> => {
  if (authEndpoint === "sign-in/email") {
    const failed = response.status >= 400;
    logOperationalEvent({
      correlationId,
      ...(failed
        ? {
            errorCode:
              response.status === 429 ? "auth_rate_limited" : "auth_failed",
          }
        : {}),
      httpStatus: response.status,
      operation: "auth.sign_in",
      outcome: failed ? "failure" : "success",
    });
  }

  if (
    authEndpoint === "sign-in/social" &&
    socialAuthRequest.provider === "google"
  ) {
    const failed = await isResponseFailure(response);
    logOperationalEvent({
      correlationId,
      ...(failed ? { errorCode: "google_oauth_start_failed" } : {}),
      httpStatus: response.status,
      operation: socialAuthRequest.requestSignUp
        ? "auth.google_sign_up"
        : "auth.google_sign_in",
      outcome: failed ? "failure" : "success",
    });
  }
};

export const GET = async (request: Request): Promise<Response> => {
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname.endsWith("/api/auth/verify-email")) {
    return new Response(null, {
      headers: {
        "cache-control": "no-store",
        location: new URL(
          "/confirmar-email?legacy=1",
          requestUrl.origin
        ).toString(),
        "referrer-policy": "no-referrer",
      },
      status: 303,
    });
  }

  const authEndpoint = requestUrl.pathname
    .replace(AUTH_API_PATH_PREFIX_PATTERN, "")
    .replace(TRAILING_SLASH_PATTERN, "");
  try {
    const accessResponse = await checkAuthenticatedPlatformAccess(
      request,
      authEndpoint
    );
    if (accessResponse) {
      return accessResponse;
    }
  } catch {
    return Response.json(
      { error: "authentication_temporarily_unavailable" },
      { headers: { "cache-control": "no-store" }, status: 503 }
    );
  }

  const response = await getAuth().handler(request);

  if (requestUrl.pathname.endsWith("/api/auth/callback/google")) {
    let providerReturnedError = false;
    const location = response.headers.get("location");
    if (location) {
      try {
        providerReturnedError = new URL(location, request.url).searchParams.has(
          "error"
        );
      } catch {
        providerReturnedError = false;
      }
    }

    const failed = response.status >= 400 || providerReturnedError;
    logOperationalEvent({
      correlationId: createCorrelationId(
        request.headers.get(CORRELATION_ID_HEADER)
      ),
      ...(failed ? { errorCode: "google_oauth_callback_failed" } : {}),
      httpStatus: response.status,
      operation: "auth.google_callback",
      outcome: failed ? "failure" : "success",
    });
  }

  return response;
};

export const POST = async (
  request: Request,
  context: AuthRouteContext
): Promise<Response> => {
  const correlationId = createCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER)
  );
  const env = getServerEnv();
  const { all = [] } = await context.params;
  const authEndpoint = all.join("/");
  const socialAuthRequest =
    authEndpoint === "sign-in/social"
      ? await getSocialAuthRequest(request)
      : { provider: null, requestSignUp: false };

  if (authEndpoint === "sign-up/email") {
    logOperationalEvent({
      correlationId,
      errorCode: "native_email_signup_blocked",
      httpStatus: 404,
      operation: "auth.sign_up",
      outcome: "failure",
    });
    return Response.json(
      { error: "email_confirmation_required" },
      { status: 404 }
    );
  }

  if (
    isBlockedAuthEndpoint({
      allowPublicSignUp: env.AUTH_PUBLIC_SIGNUP_ENABLED,
      method: request.method,
      pathSegments: all,
      requestSignUp: socialAuthRequest.requestSignUp,
    })
  ) {
    logOperationalEvent({
      correlationId,
      errorCode: "public_signup_disabled",
      httpStatus: 404,
      operation: "auth.sign_up",
      outcome: "failure",
    });
    return Response.json({ error: "public_sign_up_disabled" }, { status: 404 });
  }

  try {
    const accessResponse = await checkAuthenticatedPlatformAccess(
      request,
      authEndpoint
    );
    if (accessResponse) {
      return accessResponse;
    }
  } catch {
    return Response.json(
      { error: "authentication_temporarily_unavailable" },
      { headers: { "cache-control": "no-store" }, status: 503 }
    );
  }

  if (authEndpoint === "change-email") {
    return Response.json(
      { error: "email_change_flow_unavailable" },
      { headers: { "cache-control": "no-store" }, status: 404 }
    );
  }

  if (authEndpoint === "send-verification-email") {
    return handleVerificationEmailRequest(request, correlationId);
  }

  const nativeHandler = async (): Promise<Response> =>
    await getAuth().handler(request);
  let response: Response;
  if (
    authEndpoint === "request-password-reset" ||
    authEndpoint === "reset-password"
  ) {
    try {
      response = await withAccountPasswordResetOperation({
        endpoint: authEndpoint,
        handler: nativeHandler,
        request,
      });
    } catch {
      logOperationalEvent({
        correlationId,
        errorCode: "password_reset_operation_guard_failed",
        operation: "auth.password_reset",
        outcome: "failure",
        provider: "database",
      });
      return Response.json(
        { error: "password_reset_temporarily_unavailable" },
        { headers: { "cache-control": "no-store" }, status: 503 }
      );
    }
  } else {
    response = await nativeHandler();
  }
  await logAuthRequestOutcome({
    authEndpoint,
    correlationId,
    response,
    socialAuthRequest,
  });

  return response;
};
