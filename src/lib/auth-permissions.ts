import "server-only";
import { redirect } from "next/navigation";
import { type AuthPermission, canPerform } from "@/lib/auth-policy";
import { route } from "@/lib/routes";
import { type AppSession, requireSession } from "@/lib/session";

export const requirePermission = async (
  permission: AuthPermission
): Promise<AppSession> => {
  const session = await requireSession();

  if (!canPerform(session, permission)) {
    redirect(route("/app"));
  }

  return session;
};
