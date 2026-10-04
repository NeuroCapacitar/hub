import { previewEmailChange } from "@/features/account/email-change";
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

const parseToken = (body: unknown): string | null => {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1
  ) {
    return null;
  }
  const token = Reflect.get(body, "token");
  return typeof token === "string" && token.length > 0 && token.length <= 512
    ? token
    : null;
};

export const POST = async (request: Request): Promise<Response> => {
  const correlationId = createCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER)
  );
  let body: unknown;
  try {
    body = await readBoundedJsonBody(request, PUBLIC_JSON_BODY_MAX_BYTES);
  } catch (error) {
    return Response.json(
      { error: "invalid_email_change" },
      {
        headers: noStoreHeaders,
        status: error instanceof RequestBodyLimitError ? error.status : 400,
      }
    );
  }
  const token = parseToken(body);
  if (!token) {
    return Response.json(
      { error: "invalid_email_change" },
      { headers: noStoreHeaders, status: 400 }
    );
  }
  try {
    const preview = await previewEmailChange(token);
    if (!preview) {
      logOperationalEvent({
        correlationId,
        errorCode: "email_change_token_rejected",
        operation: "auth.email_change_preview",
        outcome: "failure",
      });
      return Response.json(
        { error: "invalid_or_expired_email_change" },
        { headers: noStoreHeaders, status: 400 }
      );
    }
    logOperationalEvent({
      correlationId,
      operation: "auth.email_change_preview",
      outcome: "success",
    });
    return Response.json(
      {
        change: {
          currentEmail: preview.currentEmail,
          expiresAt: preview.expiresAt.toISOString(),
          newEmail: preview.newEmail,
          stage: preview.stage,
          userName: preview.userName,
        },
        status: "ready",
      },
      { headers: noStoreHeaders }
    );
  } catch {
    logOperationalEvent({
      correlationId,
      errorCode: "email_change_preview_failed",
      operation: "auth.email_change_preview",
      outcome: "failure",
      provider: "database",
    });
    return Response.json(
      { error: "email_change_temporarily_unavailable" },
      { headers: noStoreHeaders, status: 503 }
    );
  }
};
