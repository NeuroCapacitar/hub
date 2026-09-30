import "server-only";
import { getPool } from "@/db";
import {
  type ActiveEmailChangeSummary,
  getActiveEmailChangeSummary,
} from "./email-change";

export interface AccountSecuritySummary {
  avatarMode: "custom" | "google" | "initials";
  googleImageAvailable: boolean;
  hasGoogleAccount: boolean;
  pendingEmailChange: ActiveEmailChangeSummary | null;
}

export const getAccountSecuritySummary = async (
  userId: string
): Promise<AccountSecuritySummary> => {
  const [methods, emailChange, avatar] = await Promise.all([
    getPool().query<{ has_google_account: boolean }>(
      [
        "select",
        "  exists (select 1 from accounts where user_id = $1 and provider_id = 'google') as has_google_account",
      ].join("\n"),
      [userId]
    ),
    getActiveEmailChangeSummary(userId),
    getPool().query<{
      avatar_mode: "custom" | "google" | "initials";
      google_image_available: boolean;
    }>(
      [
        "select profiles.avatar_mode, users.image is not null as google_image_available",
        "from profiles",
        "join users on users.id = profiles.user_id",
        "where profiles.user_id = $1",
        "limit 1",
      ].join("\n"),
      [userId]
    ),
  ]);
  const method = methods.rows[0];
  const pending = emailChange;
  const avatarState = avatar.rows[0];

  return {
    avatarMode: avatarState?.avatar_mode ?? "initials",
    googleImageAvailable: avatarState?.google_image_available ?? false,
    hasGoogleAccount: method?.has_google_account ?? false,
    pendingEmailChange: pending,
  };
};
