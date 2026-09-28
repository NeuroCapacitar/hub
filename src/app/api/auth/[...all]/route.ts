import { getAuth } from "@/lib/auth";
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

const handleVerificationEmailRequest = async (
  request: Request,
  correlationId: string
): Promise<Response> => {
  try {
    const response = await getAuth().handler(request);
    if (await isResponseFailure(response)) {
      logOperationalEvent({
        correlationId,
        errorCode: "verification_email_request_failed",
        httpStatus: response.status,
        operation: "auth.email_verification_request",
        outcome: "failure",
      });
    }
  } catch {
    logOperationalEvent({
      correlationId,
      errorCode: "verification_email_request_failed",
      operation: "auth.email_verification_request",
      outcome: "failure",
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
  const response = await getAuth().handler(request);
  const requestUrl = new URL(request.url);

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

  if (authEndpoint === "send-verification-email") {
    return handleVerificationEmailRequest(request, correlationId);
  }

  const response = await getAuth().handler(request);
  await logAuthRequestOutcome({
    authEndpoint,
    correlationId,
    response,
    socialAuthRequest,
  });

  return response;
};
