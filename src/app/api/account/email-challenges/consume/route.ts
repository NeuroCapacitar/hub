import { consumeAccountEmailChallenge } from "@/features/account/email-challenges";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
  logOperationalEvent,
} from "@/lib/observability";
import {
  PUBLIC_JSON_BODY_MAX_BYTES,
  RequestBodyLimitError,
  readBoundedJsonBody,
} from "@/lib/request-body-limits";

const noStoreHeaders = { "cache-control": "no-store" };

export const POST = async (request: Request): Promise<Response> => {
  const correlationId = createCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER)
  );
  let body: unknown;
  try {
    body = await readBoundedJsonBody(request, PUBLIC_JSON_BODY_MAX_BYTES);
  } catch (error) {
    return Response.json(
      { error: "invalid_email_challenge" },
      {
        headers: noStoreHeaders,
        status: error instanceof RequestBodyLimitError ? error.status : 400,
      }
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    typeof Reflect.get(body, "token") !== "string" ||
    Reflect.get(body, "token").length > 512
  ) {
    return Response.json(
      { error: "invalid_email_challenge" },
      { headers: noStoreHeaders, status: 400 }
    );
  }

  try {
    const result = await consumeAccountEmailChallenge(
      Reflect.get(body, "token") as string
    );
    if (!result.confirmed) {
      logOperationalEvent({
        correlationId,
        errorCode: "email_challenge_rejected",
        operation: "auth.email_challenge_confirmation",
        outcome: "failure",
      });
      return Response.json(
        { error: "invalid_or_expired_email_challenge" },
        { headers: noStoreHeaders, status: 400 }
      );
    }

    logOperationalEvent({
      correlationId,
      operation: "auth.email_challenge_confirmation",
      outcome: "success",
    });
    return Response.json(
      { nextPath: result.nextPath, status: "confirmed" },
      { headers: noStoreHeaders }
    );
  } catch {
    logOperationalEvent({
      correlationId,
      errorCode: "email_challenge_confirmation_failed",
      operation: "auth.email_challenge_confirmation",
      outcome: "failure",
      provider: "database",
    });
    return Response.json(
      { error: "email_challenge_confirmation_failed" },
      { headers: noStoreHeaders, status: 503 }
    );
  }
};
