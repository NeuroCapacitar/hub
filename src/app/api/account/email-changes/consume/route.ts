import { consumeEmailChangeToken } from "@/features/account/email-change";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
  logOperationalEvent,
} from "@/lib/observability";

const noStoreHeaders = { "cache-control": "no-store" };

export const POST = async (request: Request): Promise<Response> => {
  const correlationId = createCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER)
  );
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "invalid_email_change" },
      { headers: noStoreHeaders, status: 400 }
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
      { error: "invalid_email_change" },
      { headers: noStoreHeaders, status: 400 }
    );
  }
  try {
    const result = await consumeEmailChangeToken(
      Reflect.get(body, "token") as string
    );
    if (!result) {
      logOperationalEvent({
        correlationId,
        errorCode: "email_change_token_rejected",
        operation: "auth.email_change_confirmation",
        outcome: "failure",
      });
      return Response.json(
        { error: "invalid_or_expired_email_change" },
        { headers: noStoreHeaders, status: 400 }
      );
    }
    logOperationalEvent({
      correlationId,
      operation: "auth.email_change_confirmation",
      outcome: "success",
    });
    return Response.json(
      { nextPath: result.nextPath, status: "confirmed" },
      { headers: noStoreHeaders }
    );
  } catch {
    logOperationalEvent({
      correlationId,
      errorCode: "email_change_confirmation_failed",
      operation: "auth.email_change_confirmation",
      outcome: "failure",
      provider: "database",
    });
    return Response.json(
      { error: "email_change_temporarily_unavailable" },
      { headers: noStoreHeaders, status: 503 }
    );
  }
};
