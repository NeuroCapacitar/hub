import { requestPublicAccountRegistration } from "@/features/account/email-challenges";
import { parsePublicSignupInput } from "@/features/account/public-signup-input";
import { getServerEnv } from "@/lib/env";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
  logOperationalEvent,
} from "@/lib/observability";

const acceptedResponse = (): Response =>
  Response.json(
    { status: "accepted" },
    { headers: { "cache-control": "no-store" }, status: 202 }
  );

export const POST = async (request: Request): Promise<Response> => {
  const correlationId = createCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER)
  );
  if (!getServerEnv().AUTH_PUBLIC_SIGNUP_ENABLED) {
    return Response.json(
      { error: "public_sign_up_disabled" },
      { headers: { "cache-control": "no-store" }, status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "invalid_signup_request" },
      { headers: { "cache-control": "no-store" }, status: 400 }
    );
  }

  const input = parsePublicSignupInput(body);
  if (!input) {
    return Response.json(
      { error: "invalid_signup_request" },
      { headers: { "cache-control": "no-store" }, status: 400 }
    );
  }

  try {
    await requestPublicAccountRegistration({
      input,
      requestHeaders: request.headers,
    });
    logOperationalEvent({
      correlationId,
      operation: "auth.public_signup_request",
      outcome: "success",
    });
    return acceptedResponse();
  } catch {
    logOperationalEvent({
      correlationId,
      errorCode: "public_signup_request_failed",
      operation: "auth.public_signup_request",
      outcome: "failure",
      provider: "database",
    });
    return Response.json(
      { error: "signup_request_failed" },
      { headers: { "cache-control": "no-store" }, status: 503 }
    );
  }
};
