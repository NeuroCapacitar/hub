import { acceptStaffInvitation } from "@/features/admin/staff-invitations";
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

const parseAcceptRequest = (
  body: unknown
): { name: string; token: string } | null => {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 2
  ) {
    return null;
  }
  const token = Reflect.get(body, "token");
  const name = Reflect.get(body, "name");
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > 512 ||
    typeof name !== "string" ||
    name.length > 120
  ) {
    return null;
  }
  return { name, token };
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
      { error: "invalid_staff_invitation" },
      {
        headers: noStoreHeaders,
        status: error instanceof RequestBodyLimitError ? error.status : 400,
      }
    );
  }
  const input = parseAcceptRequest(body);
  if (!input) {
    return Response.json(
      { error: "invalid_staff_invitation" },
      { headers: noStoreHeaders, status: 400 }
    );
  }

  try {
    const accepted = await acceptStaffInvitation(input);
    if (!accepted) {
      logOperationalEvent({
        correlationId,
        errorCode: "staff_invitation_rejected",
        operation: "auth.staff_invitation_acceptance",
        outcome: "failure",
      });
      return Response.json(
        { error: "invalid_or_expired_staff_invitation" },
        { headers: noStoreHeaders, status: 400 }
      );
    }
    logOperationalEvent({
      correlationId,
      operation: "auth.staff_invitation_acceptance",
      outcome: "success",
    });
    return Response.json(
      { nextPath: accepted.nextPath, status: "accepted" },
      { headers: noStoreHeaders }
    );
  } catch {
    logOperationalEvent({
      correlationId,
      errorCode: "staff_invitation_acceptance_failed",
      operation: "auth.staff_invitation_acceptance",
      outcome: "failure",
      provider: "database",
    });
    return Response.json(
      { error: "staff_invitation_acceptance_failed" },
      { headers: noStoreHeaders, status: 503 }
    );
  }
};
