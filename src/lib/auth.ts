import "server-only";
import { dash, sentinel } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import type { GoogleProfile } from "better-auth/social-providers";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  accounts,
  profiles,
  sessions,
  users,
  verifications,
} from "@/db/schema";
import { requestExistingAccountEmailVerification } from "@/features/account/email-challenges";
import { sendBetterAuthPasswordResetEmail } from "@/lib/auth-password-reset";
import {
  getBetterAuthRateLimitConfig,
  getGoogleOAuthProviderConfig,
  getResolvedBetterAuthInfraConfig,
} from "@/lib/auth-policy";
import {
  normalizeBuyerEmail,
  resolveGoogleEmailCandidate,
} from "@/lib/email-identity";
import { getServerEnv } from "@/lib/env";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
  logOperationalEvent,
} from "@/lib/observability";
import { AUTH_PASSWORD_POLICY } from "@/lib/password-policy";
import { parseTrustedOrigins } from "@/lib/trusted-origins";

// Keep stored identity fields authoritative; use Google's picture only when no local image exists.
const mapGoogleProfileToUser = async (
  profile: GoogleProfile
): Promise<{ email?: string | null; image?: string | null; name?: string }> => {
  try {
    const linkedAccounts = await getDb()
      .select({
        email: users.email,
        image: users.image,
        name: users.name,
        userId: accounts.userId,
      })
      .from(accounts)
      .leftJoin(users, eq(users.id, accounts.userId))
      .where(
        and(
          eq(accounts.providerId, "google"),
          eq(accounts.accountId, profile.sub)
        )
      )
      .limit(2);

    if (linkedAccounts.length > 1) {
      logOperationalEvent({
        correlationId: createCorrelationId(null),
        errorCode: "google_account_identity_ambiguous",
        operation: "auth.google_profile_mapping",
        outcome: "failure",
        provider: "database",
      });
      return { email: null };
    }

    if (linkedAccounts.length === 1) {
      const linkedAccount = linkedAccounts[0];
      if (!(linkedAccount?.email && linkedAccount.name)) {
        return { email: null };
      }

      return {
        email: linkedAccount.email,
        image: linkedAccount.image ?? profile.picture,
        name: linkedAccount.name,
      };
    }

    const googleEmail = profile.email.trim().toLowerCase();
    const canonicalGoogleEmail = normalizeBuyerEmail(googleEmail);
    const candidates = await getDb()
      .select({
        email: users.email,
        image: users.image,
        name: users.name,
        userId: users.id,
      })
      .from(users)
      .where(
        eq(
          sql<string>`public.canonicalize_auth_email_identity(${users.email})`,
          canonicalGoogleEmail
        )
      )
      .limit(2);
    const resolution = resolveGoogleEmailCandidate({
      candidates,
      googleEmail,
    });

    if (resolution.kind === "none") {
      return {};
    }

    if (resolution.kind === "ambiguous") {
      logOperationalEvent({
        correlationId: createCorrelationId(null),
        errorCode: "google_email_candidate_ambiguous",
        operation: "auth.google_profile_mapping",
        outcome: "failure",
        provider: "database",
      });
      return { email: null };
    }

    const candidate = candidates.find(
      (user) => user.userId === resolution.userId
    );
    if (!candidate?.name) {
      return { email: null };
    }

    return {
      email: candidate.email,
      image: candidate.image ?? profile.picture,
      name: candidate.name,
    };
  } catch {
    logOperationalEvent({
      correlationId: createCorrelationId(null),
      errorCode: "google_email_candidate_lookup_failed",
      operation: "auth.google_profile_mapping",
      outcome: "failure",
      provider: "database",
    });
    return { email: null };
  }
};

export const isStudentPlatformAccessBlocked = async (
  userId: string
): Promise<boolean> => {
  const [profile] = await getDb()
    .select({
      platformBlockedAt: profiles.platformBlockedAt,
      role: profiles.role,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  return profile?.role === "student" && profile.platformBlockedAt !== null;
};

const verifyLocalEmailAfterPasswordReset = async (
  userId: string,
  request?: Request
): Promise<void> => {
  try {
    const updatedUsers = await getDb()
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    if (updatedUsers.length !== 1) {
      throw new Error("password_reset_user_update_missing");
    }
  } catch {
    try {
      await getDb().delete(sessions).where(eq(sessions.userId, userId));
    } catch {
      logOperationalEvent({
        correlationId: createCorrelationId(
          request?.headers.get(CORRELATION_ID_HEADER) ?? null
        ),
        errorCode: "password_reset_session_revocation_failed",
        operation: "auth.password_reset_session_revocation",
        outcome: "failure",
        provider: "database",
      });
    }

    logOperationalEvent({
      correlationId: createCorrelationId(
        request?.headers.get(CORRELATION_ID_HEADER) ?? null
      ),
      errorCode: "password_reset_email_verification_failed",
      operation: "auth.password_reset_identity_activation",
      outcome: "failure",
      provider: "database",
    });
    throw new Error("password_reset_identity_activation_failed");
  }
};

const createAuth = () => {
  const env = getServerEnv();
  const googleProviderConfig = getGoogleOAuthProviderConfig({
    allowPublicSignUp: env.AUTH_PUBLIC_SIGNUP_ENABLED,
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  });
  const betterAuthInfraConfig = getResolvedBetterAuthInfraConfig({
    apiKey: env.BETTER_AUTH_API_KEY,
    apiUrl: env.BETTER_AUTH_API_URL,
    isE2eTestMode: env.E2E_TEST_MODE,
    kvUrl: env.BETTER_AUTH_KV_URL,
  });
  const infraPlugins = betterAuthInfraConfig
    ? [
        dash(betterAuthInfraConfig),
        sentinel({
          ...betterAuthInfraConfig,
          security: {
            credentialStuffing: {
              enabled: true,
              thresholds: { block: 5, challenge: 3 },
            },
          },
        }),
      ]
    : [];

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    rateLimit: getBetterAuthRateLimitConfig(env.E2E_TEST_MODE),
    advanced: {
      trustedProxyHeaders: true,
    },
    trustedOrigins: parseTrustedOrigins({
      defaults: [env.BETTER_AUTH_URL, env.NEXT_PUBLIC_APP_URL],
      extraOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS,
    }),
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        accounts,
        sessions,
        users,
        verifications,
      },
      usePlural: true,
    }),
    account: {
      accountLinking: {
        allowDifferentEmails: false,
        disableImplicitLinking: false,
        enabled: true,
        updateUserInfoOnLink: false,
      },
      encryptOAuthTokens: true,
    },
    emailAndPassword: {
      ...AUTH_PASSWORD_POLICY,
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async (input, request) => {
        await sendBetterAuthPasswordResetEmail(input, request);
      },
      onPasswordReset: async ({ user }, request) => {
        await verifyLocalEmailAfterPasswordReset(user.id, request);
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            if (await isStudentPlatformAccessBlocked(session.userId)) {
              throw APIError.from("FORBIDDEN", {
                code: "ACCOUNT_SUSPENDED",
                message: "Acesso à plataforma suspenso.",
              });
            }
          },
        },
      },
    },
    emailVerification: {
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      sendOnSignIn: false,
      sendOnSignUp: false,
      sendVerificationEmail: async ({ user }, request) => {
        try {
          await requestExistingAccountEmailVerification({
            requestHeaders: request?.headers ?? new Headers(),
            userId: user.id,
          });
        } catch {
          logOperationalEvent({
            correlationId: createCorrelationId(
              request?.headers.get(CORRELATION_ID_HEADER) ?? null
            ),
            errorCode: "email_verification_delivery_failed",
            operation: "auth.email_verification",
            outcome: "failure",
            provider: "database",
          });
          throw new Error("email_verification_delivery_failed");
        }
      },
    },
    ...(googleProviderConfig
      ? {
          socialProviders: {
            google: {
              ...googleProviderConfig,
              mapProfileToUser: mapGoogleProfileToUser,
            },
          },
        }
      : {}),
    plugins: [...infraPlugins, nextCookies()],
  });
};

let authInstance: ReturnType<typeof createAuth> | null = null;

export const getAuth = (): ReturnType<typeof createAuth> => {
  if (!authInstance) {
    authInstance = createAuth();
  }

  return authInstance;
};
