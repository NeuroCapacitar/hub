import { betterAuth } from "better-auth";
import { type MemoryDB, memoryAdapter } from "better-auth/adapters/memory";
import type { GoogleProfile } from "better-auth/social-providers";
import { convertSetCookieToCookie } from "better-auth/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyConfirmedPaymentAccess } from "@/features/payments/apply-authoritative-financial-evidence";
import type { OrderIdentityQueryClient } from "@/features/payments/order-identity";
import { resolveLocalOrderIdentity } from "@/features/payments/order-identity";
import { getGoogleOAuthProviderConfig } from "./auth-policy";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    GOOGLE_CLIENT_ID: "google-client-id-fixture",
    GOOGLE_CLIENT_SECRET: "google-client-secret-fixture",
  }),
}));

const APP_URL = "http://localhost:3000";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_TEST_PROFILE: GoogleProfile = {
  aud: "google-client-id-fixture",
  azp: "google-client-id-fixture",
  email: "student@example.test",
  email_verified: true,
  exp: 4_102_444_800,
  family_name: "Example",
  given_name: "Student",
  iat: 1_767_225_600,
  iss: "https://accounts.google.com",
  name: "Student Example",
  picture: "https://images.example.test/student.jpg",
  sub: "google-sub-fixture",
};

type GoogleOAuthMemoryDB = MemoryDB & {
  account: Record<string, unknown>[];
  enrollmentGrant: unknown[];
  order: unknown[];
  session: Record<string, unknown>[];
  user: Record<string, unknown>[];
  verification: Record<string, unknown>[];
};

const encodeJwtPart = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const makeTestIdToken = (profile: GoogleProfile): string =>
  `${encodeJwtPart({ alg: "none", typ: "JWT" })}.${encodeJwtPart(profile)}.test-signature`;

const createSocialAuth = ({
  allowPublicSignUp = true,
  profile = GOOGLE_TEST_PROFILE,
}: {
  allowPublicSignUp?: boolean;
  profile?: GoogleProfile;
} = {}) => {
  const database: GoogleOAuthMemoryDB = {
    account: [],
    enrollmentGrant: [],
    order: [],
    session: [],
    user: [],
    verification: [],
  };
  const googleProvider = getGoogleOAuthProviderConfig({
    allowPublicSignUp,
    clientId: "google-client-id-fixture",
    clientSecret: "google-client-secret-fixture",
  });
  if (!googleProvider) {
    throw new Error("Expected a Google provider fixture.");
  }

  const mapProfileToUser = (googleProfile: GoogleProfile) => {
    const linkedAccount = database.account.find(
      (account) =>
        account.providerId === "google" &&
        account.accountId === googleProfile.sub
    );
    const matchedUser = linkedAccount
      ? database.user.find((user) => user.id === linkedAccount.userId)
      : database.user.find(
          (user) =>
            typeof user.email === "string" &&
            user.email.toLowerCase() === googleProfile.email.toLowerCase()
        );

    if (
      !matchedUser ||
      typeof matchedUser.email !== "string" ||
      typeof matchedUser.name !== "string"
    ) {
      return {};
    }

    return {
      email: matchedUser.email,
      image:
        typeof matchedUser.image === "string"
          ? matchedUser.image
          : googleProfile.picture,
      name: matchedUser.name,
    };
  };

  const auth = betterAuth({
    account: {
      accountLinking: {
        allowDifferentEmails: false,
        disableImplicitLinking: false,
        enabled: true,
        updateUserInfoOnLink: false,
      },
    },
    baseURL: APP_URL,
    database: memoryAdapter(database),
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false },
    secret: "oauth-flow-test-secret-that-is-at-least-thirty-two-chars",
    socialProviders: {
      google: {
        ...googleProvider,
        overrideUserInfoOnSignIn: true,
        mapProfileToUser,
        getUserInfo: async () => {
          const mappedUser = await mapProfileToUser(profile);
          return {
            data: profile,
            user: {
              id: profile.sub,
              email: profile.email,
              emailVerified: profile.email_verified,
              name: profile.name,
              image: profile.picture,
              ...mappedUser,
            },
          };
        },
      },
    },
  });

  return { auth, database };
};

const makeGoogleTokenFetch = (profile: GoogleProfile): typeof fetch =>
  vi.fn<typeof fetch>((input) => {
    if (String(input) !== GOOGLE_TOKEN_URL) {
      throw new Error(
        "Unexpected network request in the Google OAuth fixture."
      );
    }

    return Promise.resolve(
      Response.json({
        access_token: "google-access-token-fixture",
        expires_in: 3600,
        id_token: makeTestIdToken(profile),
        scope: "openid email profile",
        token_type: "Bearer",
      })
    );
  });

const getObjectProperty = (value: unknown, property: string): unknown =>
  typeof value === "object" && value !== null
    ? Reflect.get(value, property)
    : undefined;

interface TestAuthHandler {
  handler(request: Request): Promise<Response>;
}

const startAndCompleteGoogleOAuth = async ({
  auth,
  requestSignUp,
}: {
  auth: TestAuthHandler;
  requestSignUp?: boolean;
}): Promise<Response> => {
  const callbackURL = `${APP_URL}/oauth/callback`;
  const startResponse = await auth.handler(
    new Request(`${APP_URL}/api/auth/sign-in/social`, {
      body: JSON.stringify({
        callbackURL,
        errorCallbackURL: callbackURL,
        newUserCallbackURL: callbackURL,
        provider: "google",
        ...(requestSignUp ? { requestSignUp: true } : {}),
      }),
      headers: {
        "content-type": "application/json",
        origin: APP_URL,
      },
      method: "POST",
    })
  );
  const authorization = await startResponse.json();
  const authorizationUrlValue = getObjectProperty(authorization, "url");
  if (typeof authorizationUrlValue !== "string") {
    throw new Error("Better Auth did not return a Google authorization URL.");
  }

  const authorizationUrl = new URL(authorizationUrlValue);
  const state = authorizationUrl.searchParams.get("state");
  if (!state) {
    throw new Error("The Google authorization URL did not include state.");
  }

  const cookies = convertSetCookieToCookie(new Headers(startResponse.headers));
  const cookie = cookies.get("cookie");
  if (!cookie) {
    throw new Error("Better Auth did not persist OAuth state in a cookie.");
  }

  return auth.handler(
    new Request(
      `${APP_URL}/api/auth/callback/google?${new URLSearchParams({ code: "fake-google-code", state })}`,
      {
        headers: { cookie, origin: APP_URL },
      }
    )
  );
};

const createOrderIdentityMemoryQuery =
  (database: GoogleOAuthMemoryDB): OrderIdentityQueryClient["query"] =>
  (queryText, values = []) => {
    if (queryText.includes("where lower(u.email) = $1")) {
      const matchingUser = database.user.find(
        (user) =>
          typeof user.email === "string" &&
          user.email.toLowerCase() === values[0]
      );
      const rows = matchingUser
        ? [
            {
              course_revoked: false,
              email_verified: matchingUser.emailVerified === true,
              id: matchingUser.id,
              platform_blocked_at: null,
              role: "student",
            },
          ]
        : [];
      return Promise.resolve({ rows });
    }

    if (queryText.includes("update orders")) {
      return Promise.resolve({ rows: [{ user_id: values[1] }] });
    }

    throw new Error("Unexpected query in paid-order fixture.");
  };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Better Auth Google OAuth flow with a fake token endpoint", () => {
  it("does not create any identity when an unknown email uses the login-only flow", async () => {
    vi.stubGlobal("fetch", makeGoogleTokenFetch(GOOGLE_TEST_PROFILE));
    const { auth, database } = createSocialAuth();

    const response = await startAndCompleteGoogleOAuth({ auth });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/oauth/callback?");
    expect(database.user).toHaveLength(0);
    expect(database.account).toHaveLength(0);
    expect(database.session).toHaveLength(0);
  });

  it("creates a Google identity only after explicit signup and creates no purchase access", async () => {
    vi.stubGlobal("fetch", makeGoogleTokenFetch(GOOGLE_TEST_PROFILE));
    const { auth, database } = createSocialAuth();

    const response = await startAndCompleteGoogleOAuth({
      auth,
      requestSignUp: true,
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${APP_URL}/oauth/callback`);
    expect(database.user).toHaveLength(1);
    expect(database.account).toHaveLength(1);
    expect(database.session).toHaveLength(1);
    expect(database.account[0]).toMatchObject({
      accountId: GOOGLE_TEST_PROFILE.sub,
      providerId: "google",
      userId: database.user[0]?.id,
    });
    expect(database.user[0]).toMatchObject({
      email: GOOGLE_TEST_PROFILE.email,
      emailVerified: true,
      image: GOOGLE_TEST_PROFILE.picture,
    });
    expect(database.order).toHaveLength(0);
    expect(database.enrollmentGrant).toHaveLength(0);
  });

  it("does not create a Google identity when signup is explicitly requested but disabled", async () => {
    vi.stubGlobal("fetch", makeGoogleTokenFetch(GOOGLE_TEST_PROFILE));
    const { auth, database } = createSocialAuth({ allowPublicSignUp: false });

    const response = await startAndCompleteGoogleOAuth({
      auth,
      requestSignUp: true,
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/oauth/callback?");
    expect(database.user).toHaveLength(0);
    expect(database.account).toHaveLength(0);
    expect(database.session).toHaveLength(0);
  });

  it("adds the Google image when linking without replacing local name or email", async () => {
    const profile: GoogleProfile = {
      ...GOOGLE_TEST_PROFILE,
      name: "Google Profile Name",
    };
    vi.stubGlobal("fetch", makeGoogleTokenFetch(profile));
    const { auth, database } = createSocialAuth({ profile });
    const localSignUp = await auth.api.signUpEmail({
      body: {
        email: profile.email,
        name: "Original Local Name",
        password: "Local-password-123!",
      },
    });
    const userId = localSignUp.user.id;
    const localUser = database.user.find((user) => user.id === userId);
    if (!localUser) {
      throw new Error("Expected the local test account to exist.");
    }
    localUser.emailVerified = true;

    const response = await startAndCompleteGoogleOAuth({ auth });

    expect(response.status).toBe(302);
    expect(database.user).toHaveLength(1);
    expect(database.account).toHaveLength(2);
    expect(
      database.account.find((account) => account.providerId === "google")
    ).toMatchObject({ accountId: profile.sub, userId });
    expect(database.user[0]).toMatchObject({
      email: profile.email,
      image: profile.picture,
      name: "Original Local Name",
    });
  });

  it("preserves a local avatar when linking a Google account", async () => {
    const profile: GoogleProfile = {
      ...GOOGLE_TEST_PROFILE,
      name: "Google Profile Name",
    };
    vi.stubGlobal("fetch", makeGoogleTokenFetch(profile));
    const { auth, database } = createSocialAuth({ profile });
    const localSignUp = await auth.api.signUpEmail({
      body: {
        email: profile.email,
        name: "Original Local Name",
        password: "Local-password-123!",
      },
    });
    const localUser = database.user.find(
      (user) => user.id === localSignUp.user.id
    );
    if (!localUser) {
      throw new Error("Expected the local test account to exist.");
    }
    localUser.emailVerified = true;
    localUser.image = "https://hub.example.test/custom-avatar.png";

    await startAndCompleteGoogleOAuth({ auth });

    expect(localUser).toMatchObject({
      email: profile.email,
      image: "https://hub.example.test/custom-avatar.png",
      name: "Original Local Name",
    });
  });

  it("fills a missing Google avatar for an already linked account on the next sign-in", async () => {
    const profile: GoogleProfile = {
      ...GOOGLE_TEST_PROFILE,
      name: "Google Profile Name",
    };
    vi.stubGlobal("fetch", makeGoogleTokenFetch(profile));
    const { auth, database } = createSocialAuth({ profile });
    const localSignUp = await auth.api.signUpEmail({
      body: {
        email: profile.email,
        name: "Original Local Name",
        password: "Local-password-123!",
      },
    });
    const localUser = database.user.find(
      (user) => user.id === localSignUp.user.id
    );
    if (!localUser) {
      throw new Error("Expected the local test account to exist.");
    }
    localUser.emailVerified = true;
    await startAndCompleteGoogleOAuth({ auth });
    localUser.image = null;

    const response = await startAndCompleteGoogleOAuth({ auth });

    expect(response.status).toBe(302);
    expect(localUser).toMatchObject({
      email: profile.email,
      image: profile.picture,
      name: "Original Local Name",
    });
  });

  it("does not auto-link an unverified local account or create a duplicate", async () => {
    vi.stubGlobal("fetch", makeGoogleTokenFetch(GOOGLE_TEST_PROFILE));
    const { auth, database } = createSocialAuth();
    const localSignUp = await auth.api.signUpEmail({
      body: {
        email: GOOGLE_TEST_PROFILE.email,
        name: "Local Student",
        password: "Local-password-123!",
      },
    });
    const localUser = database.user.find(
      (user) => user.id === localSignUp.user.id
    );
    if (!localUser) {
      throw new Error("Expected the local test account to exist.");
    }
    expect(localUser.emailVerified).toBe(false);
    const existingSessionCount = database.session.length;

    const response = await startAndCompleteGoogleOAuth({ auth });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/oauth/callback?");
    expect(database.user).toHaveLength(1);
    expect(database.account).toHaveLength(1);
    expect(database.account[0]?.providerId).toBe("credential");
    expect(database.session).toHaveLength(existingSessionCount);
  });

  it("still rejects first linking when Google does not verify the email", async () => {
    const profile: GoogleProfile = {
      ...GOOGLE_TEST_PROFILE,
      email_verified: false,
    };
    vi.stubGlobal("fetch", makeGoogleTokenFetch(profile));
    const { auth, database } = createSocialAuth({ profile });
    const localSignUp = await auth.api.signUpEmail({
      body: {
        email: profile.email,
        name: "Local Student",
        password: "Local-password-123!",
      },
    });
    const localUser = database.user.find(
      (user) => user.id === localSignUp.user.id
    );
    if (!localUser) {
      throw new Error("Expected the local test account to exist.");
    }
    localUser.emailVerified = true;

    const response = await startAndCompleteGoogleOAuth({ auth });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/oauth/callback?");
    expect(database.user).toHaveLength(1);
    expect(database.account).toHaveLength(1);
    expect(database.account[0]?.providerId).toBe("credential");
  });

  it("keeps payment, access, and purchase confirmation on the Google-created user", async () => {
    const profile: GoogleProfile = {
      ...GOOGLE_TEST_PROFILE,
      email: "First.Last+course@googlemail.com",
    };
    vi.stubGlobal("fetch", makeGoogleTokenFetch(profile));
    const { auth, database } = createSocialAuth({ profile });
    const callback = await startAndCompleteGoogleOAuth({
      auth,
      requestSignUp: true,
    });
    expect(callback.status).toBe(302);

    const googleUser = database.user[0];
    if (!googleUser || typeof googleUser.id !== "string") {
      throw new Error("Expected the Google signup to create its user.");
    }

    const identityQuery = createOrderIdentityMemoryQuery(database);
    const transactionQuery = vi.fn((queryText: string) => {
      if (
        queryText.includes("with transitioned as") ||
        queryText.includes("provider_customer_id = $2")
      ) {
        return { rows: [{ id: "paid-order-fixture" }] };
      }
      if (
        queryText.includes("from purchase_confirmation_intents") ||
        queryText.includes("from outbox_messages as message")
      ) {
        return { rows: [] };
      }
      if (queryText.includes("select email_verified")) {
        return {
          rows: [{ email_verified: database.user[0]?.emailVerified === true }],
        };
      }
      if (queryText.includes("insert into purchase_confirmation_intents")) {
        return { rows: [{ order_id: "paid-order-fixture" }] };
      }
      return { rows: [] };
    });
    const applyPaidAccess = vi.fn().mockResolvedValue(undefined);
    const enqueueMessage = vi.fn().mockResolvedValue(undefined);

    await expect(
      applyConfirmedPaymentAccess({
        applyPaidAccess,
        client: { query: transactionQuery } as never,
        enqueueMessage,
        order: {
          accessDurationMonths: 12,
          buyerIdentityStatus: "pending",
          courseId: "course-paid-fixture",
          customerEmail: null,
          customerName: null,
          id: "paid-order-fixture",
          providerCustomerId: null,
          status: "pending",
          userId: null,
        },
        preparation: {
          customerId: "asaas-customer-fixture",
          identity: { email: profile.email, name: profile.name },
          kind: "resolved",
          orderId: "paid-order-fixture",
        },
        resolveIdentity: async ({ order }) =>
          resolveLocalOrderIdentity({
            client: { query: identityQuery },
            order,
          }),
      })
    ).resolves.toBe(true);

    expect(applyPaidAccess).toHaveBeenCalledWith(
      expect.objectContaining({ userId: googleUser.id })
    );
    expect(enqueueMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          idempotencyKey: "email.purchase-confirmed/paid-order-fixture/v1",
          topic: "email.purchase-confirmed",
        }),
      })
    );
    expect(database.user).toHaveLength(1);
    expect(database.account).toHaveLength(1);
    expect(database.order).toHaveLength(0);
    expect(database.enrollmentGrant).toHaveLength(0);
  });
});
