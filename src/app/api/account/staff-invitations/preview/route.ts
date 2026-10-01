import { previewStaffInvitation } from "@/features/admin/staff-invitations";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
  logOperationalEvent,
} from "@/lib/observability";

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
    body = await request.json();
  } catch {
    return Response.json(
      { error: "invalid_staff_invitation" },
      { headers: noStoreHeaders, status: 400 }
    );
  }
  const token = parseToken(body);
  if (!token) {
    return Response.json(
      { error: "invalid_staff_invitation" },
      { headers: noStoreHeaders, status: 400 }
    );
  }

  try {
    const invitation = await previewStaffInvitation(token);
    if (!invitation) {
      logOperationalEvent({
        correlationId,
        errorCode: "staff_invitation_rejected",
        operation: "auth.staff_invitation_preview",
        outcome: "failure",
      });
      return Response.json(
        { error: "invalid_or_expired_staff_invitation" },
        { headers: noStoreHeaders, status: 400 }
      );
    }
    logOperationalEvent({
      correlationId,
      operation: "auth.staff_invitation_preview",
      outcome: "success",
    });
    return Response.json(
      {
        invitation: {
          alreadyAccepted: invitation.alreadyAccepted,
          email: invitation.email,
          existingStudent: invitation.existingStudent,
          expiresAt: invitation.expiresAt.toISOString(),
          inviterName: invitation.inviterName,
          requiresName: invitation.requiresName,
          role: invitation.role,
          willRemovePassword: invitation.willRemovePassword,
        },
        status: "ready",
      },
      { headers: noStoreHeaders }
    );
  } catch {
    logOperationalEvent({
      correlationId,
      errorCode: "staff_invitation_preview_failed",
      operation: "auth.staff_invitation_preview",
      outcome: "failure",
      provider: "database",
    });
    return Response.json(
      { error: "staff_invitation_unavailable" },
      { headers: noStoreHeaders, status: 503 }
    );
  }
};
