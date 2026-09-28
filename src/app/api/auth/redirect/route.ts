import { NextResponse } from "next/server";
import { resolvePostAuthRedirect } from "@/lib/auth-redirect";
import { createCorrelationId, logOperationalEvent } from "@/lib/observability";
import { getCurrentSession, recordLastAccess } from "@/lib/session";

export const GET = async (request: Request): Promise<NextResponse> => {
  const searchParams = new URL(request.url).searchParams;
  const returnToValues = searchParams.getAll("returnTo");
  const returnTo = returnToValues.length === 1 ? returnToValues[0] : null;
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ redirectTo: "/entrar" }, { status: 401 });
  }

  const redirect = resolvePostAuthRedirect(session, returnTo);
  if (redirect.kind === "blocked") {
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  }

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

  return NextResponse.json({
    redirectTo: redirect.destination,
  });
};
