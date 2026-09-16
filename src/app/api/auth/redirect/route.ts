import { NextResponse } from "next/server";
import { getSafeAuthReturnTo } from "@/lib/auth-return-to";
import { createCorrelationId, logOperationalEvent } from "@/lib/observability";
import { getCurrentSession, recordStudentLastAccess } from "@/lib/session";

export const GET = async (request: Request): Promise<NextResponse> => {
  const searchParams = new URL(request.url).searchParams;
  const returnToValues = searchParams.getAll("returnTo");
  const safeReturnTo =
    returnToValues.length === 1 ? getSafeAuthReturnTo(returnToValues[0]) : null;
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ redirectTo: "/entrar" }, { status: 401 });
  }

  if (session.role === "student" && session.platformBlockedAt) {
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  }

  if (session.role === "student") {
    try {
      await recordStudentLastAccess(session.user.id);
    } catch {
      logOperationalEvent({
        correlationId: createCorrelationId(null),
        errorCode: "student_last_access_update_failed",
        operation: "auth.last_access",
        outcome: "failure",
        provider: "database",
      });
    }
  }

  return NextResponse.json({
    redirectTo:
      session.role === "student" ? (safeReturnTo ?? "/app") : "/admin",
  });
};
