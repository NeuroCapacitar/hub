import type { GoogleProfile } from "better-auth/social-providers";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  betterAuth: vi.fn((_options: unknown) => ({ handler: vi.fn() })),
  getDb: vi.fn(() => ({})),
  getServerEnv: vi.fn(),
  logOperationalEvent: vi.fn(),
  requestExistingAccountEmailVerification: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@better-auth/infra", () => ({
  dash: vi.fn(() => ({ name: "dash" })),
  sentinel: vi.fn(() => ({ name: "sentinel" })),
}));
vi.mock("better-auth", () => ({ betterAuth: dependencies.betterAuth }));
vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: vi.fn(() => ({ name: "drizzle" })),
}));
vi.mock("better-auth/next-js", () => ({
  nextCookies: vi.fn(() => ({ name: "next-cookies" })),
}));
vi.mock("@/db", () => ({ getDb: dependencies.getDb }));
vi.mock("@/features/account/email-challenges", () => ({
  requestExistingAccountEmailVerification:
    dependencies.requestExistingAccountEmailVerification,
}));
vi.mock("@/lib/auth-password-reset", () => ({
  sendBetterAuthPasswordResetEmail: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("@/lib/observability", () => ({
  CORRELATION_ID_HEADER: "x-correlation-id",
  createCorrelationId: vi.fn(() => "test-correlation-id"),
  logOperationalEvent: dependencies.logOperationalEvent,
}));

const getAuthOptions = async (
  environment: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  vi.resetModules();
  dependencies.betterAuth.mockClear();
  dependencies.getServerEnv.mockReturnValue(environment);

  const { getAuth } = await import("./auth");
  getAuth();

  const [options] = dependencies.betterAuth.mock.calls.at(-1) ?? [];
  if (!options || typeof options !== "object") {
    throw new Error("Expected Better Auth to receive options.");
  }

  return options as Record<string, unknown>;
};

const GOOGLE_PROFILE: GoogleProfile = {
  aud: "google-client-id-fixture",
  azp: "google-client-id-fixture",
  email: "First.Last+course@googlemail.com",
  email_verified: true,
  exp: 1,
  family_name: "Example",
  given_name: "Student",
  iat: 1,
  iss: "https://accounts.google.com",
  name: "Student Example",
  picture: "https://images.example.test/student.jpg",
  sub: "google-sub-fixture",
};

const configureDatabaseResults = (
  results: unknown[][]
): { whereConditions: unknown[] } => {
  const whereConditions: unknown[] = [];
  const select = vi.fn(() => {
    const rows = results.shift() ?? [];
    const query = {
      from: () => query,
      leftJoin: () => query,
      limit: () => Promise.resolve(rows),
      where: (condition: unknown) => {
        whereConditions.push(condition);
        return query;
      },
    };
    return query;
  });

  dependencies.getDb.mockClear();
  dependencies.getDb.mockReturnValue({ select } as never);
  return { whereConditions };
};

const configureEmailVerificationUpdate = (rows: unknown[]) => {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const deleteSessions = vi.fn(() => ({ where: deleteWhere }));
  dependencies.getDb.mockReturnValue({
    delete: deleteSessions,
    update,
  } as never);
  return { deleteSessions, deleteWhere, returning, set, update, where };
};

const getGoogleProfileMapper = (
  options: Record<string, unknown>
): ((profile: GoogleProfile) => Promise<unknown>) | null => {
  const socialProviders = options.socialProviders;
  expect(socialProviders).toBeDefined();
  if (!socialProviders || typeof socialProviders !== "object") {
    return null;
  }

  const google = Reflect.get(socialProviders, "google");
  expect(google).toBeDefined();
  if (!google || typeof google !== "object") {
    return null;
  }

  const mapper = Reflect.get(google, "mapProfileToUser");
  expect(mapper).toBeTypeOf("function");
  return typeof mapper === "function"
    ? (mapper as (profile: GoogleProfile) => Promise<unknown>)
    : null;
};

const authEnvironment = (overrides: Record<string, unknown> = {}) => ({
  AUTH_PUBLIC_SIGNUP_ENABLED: false,
  BETTER_AUTH_API_KEY: undefined,
  BETTER_AUTH_API_URL: undefined,
  BETTER_AUTH_KV_URL: undefined,
  BETTER_AUTH_SECRET: "test-auth-secret-with-at-least-thirty-two-characters",
  BETTER_AUTH_TRUSTED_ORIGINS: undefined,
  BETTER_AUTH_URL: "http://localhost:3000",
  E2E_TEST_MODE: false,
  GOOGLE_CLIENT_ID: undefined,
  GOOGLE_CLIENT_SECRET: undefined,
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  ...overrides,
});

describe("Better Auth Google configuration", () => {
  beforeEach(() => {
    dependencies.getDb.mockClear();
    dependencies.logOperationalEvent.mockClear();
    dependencies.requestExistingAccountEmailVerification.mockReset();
  });

  it("does not register a Google provider without OAuth credentials", async () => {
    const options = await getAuthOptions(authEnvironment());

    expect(options.socialProviders).toBeUndefined();
  });

  it("keeps login-only policy, local linking safeguards and token protection", async () => {
    const options = await getAuthOptions(
      authEnvironment({
        GOOGLE_CLIENT_ID: "google-client-id-fixture",
        GOOGLE_CLIENT_SECRET: "google-client-secret-fixture",
      })
    );
    const providers = options.socialProviders as Record<string, unknown>;
    const google = providers.google as Record<string, unknown>;
    const account = options.account as Record<string, unknown>;
    const accountLinking = account.accountLinking as Record<string, unknown>;
    const emailVerification = options.emailVerification as Record<
      string,
      unknown
    >;

    expect(google).toMatchObject({
      clientId: "google-client-id-fixture",
      clientSecret: "google-client-secret-fixture",
      disableIdTokenSignIn: true,
      disableImplicitSignUp: true,
      disableSignUp: true,
      overrideUserInfoOnSignIn: true,
    });
    expect(google).not.toHaveProperty("scope");
    expect(account).toMatchObject({ encryptOAuthTokens: true });
    expect(accountLinking).toMatchObject({
      allowDifferentEmails: false,
      disableImplicitLinking: false,
      enabled: true,
      updateUserInfoOnLink: false,
    });
    expect(accountLinking).not.toHaveProperty("requireLocalEmailVerified");
    expect(emailVerification).toMatchObject({
      autoSignInAfterVerification: false,
      sendOnSignIn: false,
      sendOnSignUp: false,
    });
    expect(emailVerification.sendVerificationEmail).toBeTypeOf("function");
    expect(options.emailAndPassword).toMatchObject({
      requireEmailVerification: true,
    });
    expect(accountLinking).not.toHaveProperty("trustedProviders");

    const sendVerification = emailVerification.sendVerificationEmail as (
      input: {
        user: { id: string };
      },
      request?: Request
    ) => Promise<void>;
    dependencies.requestExistingAccountEmailVerification.mockResolvedValue(
      "queued"
    );
    const request = new Request(
      "http://localhost:3000/api/auth/send-verification-email",
      { headers: { "x-correlation-id": "request-correlation-id" } }
    );
    await sendVerification(
      {
        user: { id: "student-1" },
      },
      request
    );

    expect(
      dependencies.requestExistingAccountEmailVerification
    ).toHaveBeenCalledWith({
      requestHeaders: request.headers,
      userId: "student-1",
    });
  });

  it("rejects new Better Auth sessions for a platform-blocked Student", async () => {
    const options = await getAuthOptions(authEnvironment());
    const databaseHooks = options.databaseHooks as
      | { session?: { create?: { before?: unknown } } }
      | undefined;

    expect(databaseHooks?.session?.create?.before).toBeTypeOf("function");
    if (typeof databaseHooks?.session?.create?.before !== "function") {
      return;
    }
    configureDatabaseResults([
      [{ platformBlockedAt: new Date(), role: "student" }],
    ]);
    await expect(
      databaseHooks.session.create.before({ userId: "blocked-student" })
    ).rejects.toMatchObject({ body: { code: "ACCOUNT_SUSPENDED" } });
  });

  it("still allows a non-Student to create a session when a block timestamp is present", async () => {
    const options = await getAuthOptions(authEnvironment());
    const databaseHooks = options.databaseHooks as {
      session: {
        create: { before: (session: { userId: string }) => Promise<void> };
      };
    };
    configureDatabaseResults([
      [{ platformBlockedAt: new Date(), role: "admin" }],
    ]);

    await expect(
      databaseHooks.session.create.before({ userId: "admin-user" })
    ).resolves.toBeUndefined();
  });

  it("marks the local email verified only after Better Auth successfully resets the password", async () => {
    const options = await getAuthOptions(authEnvironment());
    const emailAndPassword = options.emailAndPassword as Record<
      string,
      unknown
    >;
    const onPasswordReset = emailAndPassword.onPasswordReset;
    expect(onPasswordReset).toBeTypeOf("function");
    expect(emailAndPassword.requireEmailVerification).toBe(true);
    if (typeof onPasswordReset !== "function") {
      return;
    }

    const database = configureEmailVerificationUpdate([{ id: "student-1" }]);
    const request = new Request(
      "http://localhost:3000/api/auth/reset-password",
      {
        headers: { "x-correlation-id": "request-correlation-id" },
        method: "POST",
      }
    );

    await onPasswordReset(
      { user: { email: "student@example.test", id: "student-1" } },
      request
    );
    await onPasswordReset(
      { user: { email: "student@example.test", id: "student-1" } },
      request
    );

    expect(database.update).toHaveBeenCalledTimes(2);
    expect(database.set).toHaveBeenCalledWith(
      expect.objectContaining({
        emailVerified: true,
        updatedAt: expect.any(Date),
      })
    );
    expect(database.returning).toHaveBeenCalledTimes(2);
    expect(dependencies.logOperationalEvent).not.toHaveBeenCalled();
  });

  it("fails the reset callback closed and logs no identity if account activation cannot be confirmed", async () => {
    const options = await getAuthOptions(authEnvironment());
    const emailAndPassword = options.emailAndPassword as Record<
      string,
      unknown
    >;
    const onPasswordReset = emailAndPassword.onPasswordReset;
    expect(onPasswordReset).toBeTypeOf("function");
    if (typeof onPasswordReset !== "function") {
      return;
    }

    const database = configureEmailVerificationUpdate([]);
    await expect(
      onPasswordReset(
        { user: { email: "private@example.test", id: "private-user-id" } },
        new Request("http://localhost:3000/api/auth/reset-password")
      )
    ).rejects.toThrow("password_reset_identity_activation_failed");

    expect(database.deleteSessions).toHaveBeenCalledOnce();

    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "password_reset_email_verification_failed",
        operation: "auth.password_reset_identity_activation",
        outcome: "failure",
        provider: "database",
      })
    );
    const loggedEvents = JSON.stringify(
      dependencies.logOperationalEvent.mock.calls
    );
    expect(loggedEvents).not.toContain("private@example.test");
    expect(loggedEvents).not.toContain("private-user-id");
  });

  it("allows explicit Google registration only when public signup is enabled", async () => {
    const options = await getAuthOptions(
      authEnvironment({
        AUTH_PUBLIC_SIGNUP_ENABLED: true,
        GOOGLE_CLIENT_ID: "google-client-id-fixture",
        GOOGLE_CLIENT_SECRET: "google-client-secret-fixture",
      })
    );
    const providers = options.socialProviders as Record<string, unknown>;
    const google = providers.google as Record<string, unknown>;

    expect(google.disableImplicitSignUp).toBe(true);
    expect(google.disableSignUp).toBe(false);
  });

  it("leaves an unmatched Google email unchanged for explicit signup", async () => {
    const options = await getAuthOptions(
      authEnvironment({
        AUTH_PUBLIC_SIGNUP_ENABLED: true,
        GOOGLE_CLIENT_ID: "google-client-id-fixture",
        GOOGLE_CLIENT_SECRET: "google-client-secret-fixture",
      })
    );
    const mapper = getGoogleProfileMapper(options);
    expect(mapper).not.toBeNull();
    if (!mapper) {
      return;
    }

    configureDatabaseResults([[], []]);
    expect(await mapper(GOOGLE_PROFILE)).toEqual({});
  });

  it("returns a generic failure and logs no identity when verification email delivery fails", async () => {
    const options = await getAuthOptions(
      authEnvironment({
        GOOGLE_CLIENT_ID: "google-client-id-fixture",
        GOOGLE_CLIENT_SECRET: "google-client-secret-fixture",
      })
    );
    const emailVerification = options.emailVerification as Record<
      string,
      unknown
    >;
    const sendVerification = emailVerification.sendVerificationEmail as (
      input: {
        user: { id: string };
      },
      request?: Request
    ) => Promise<void>;
    dependencies.requestExistingAccountEmailVerification.mockRejectedValueOnce(
      new Error("raw-provider-error-with-token")
    );

    await expect(
      sendVerification(
        {
          user: { id: "private-user-id" },
        },
        new Request("http://localhost:3000/api/auth/send-verification-email")
      )
    ).rejects.toThrow("email_verification_delivery_failed");

    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "email_verification_delivery_failed",
        operation: "auth.email_verification",
        outcome: "failure",
        provider: "database",
      })
    );
    expect(
      JSON.stringify(dependencies.logOperationalEvent.mock.calls)
    ).not.toContain("private@example.test");
    expect(
      JSON.stringify(dependencies.logOperationalEvent.mock.calls)
    ).not.toContain("private-token");
    expect(
      JSON.stringify(dependencies.logOperationalEvent.mock.calls)
    ).not.toContain("raw-provider-error-with-token");
  });

  it("keeps an already linked Google identity and local name while filling a missing image", async () => {
    const options = await getAuthOptions(
      authEnvironment({
        GOOGLE_CLIENT_ID: "google-client-id-fixture",
        GOOGLE_CLIENT_SECRET: "google-client-secret-fixture",
      })
    );
    const mapper = getGoogleProfileMapper(options);
    expect(mapper).not.toBeNull();
    if (!mapper) {
      return;
    }

    configureDatabaseResults([
      [
        {
          email: "local@example.test",
          image: null,
          name: "Local Name",
          userId: "linked-user",
        },
      ],
    ]);
    const mappedProfile = await mapper({
      ...GOOGLE_PROFILE,
      email: "changed-address@example.test",
    });

    expect(mappedProfile).toEqual({
      email: "local@example.test",
      image: GOOGLE_PROFILE.picture,
      name: "Local Name",
    });
    expect(dependencies.getDb).toHaveBeenCalledOnce();
  });

  it("maps only a unique exact or canonical email match without changing Google identity claims", async () => {
    const options = await getAuthOptions(
      authEnvironment({
        GOOGLE_CLIENT_ID: "google-client-id-fixture",
        GOOGLE_CLIENT_SECRET: "google-client-secret-fixture",
      })
    );
    const mapper = getGoogleProfileMapper(options);
    expect(mapper).not.toBeNull();
    if (!mapper) {
      return;
    }

    configureDatabaseResults([
      [],
      [
        {
          email: "firstlast@gmail.com",
          image: null,
          name: "Existing Student Name",
          userId: "paid-user",
        },
      ],
    ]);
    const mappedProfile = await mapper(GOOGLE_PROFILE);

    expect(mappedProfile).toEqual({
      email: "firstlast@gmail.com",
      image: GOOGLE_PROFILE.picture,
      name: "Existing Student Name",
    });
  });

  it("queries the database by canonical identity when a Google address omits a plus tag", async () => {
    const options = await getAuthOptions(
      authEnvironment({
        GOOGLE_CLIENT_ID: "google-client-id-fixture",
        GOOGLE_CLIENT_SECRET: "google-client-secret-fixture",
      })
    );
    const mapper = getGoogleProfileMapper(options);
    expect(mapper).not.toBeNull();
    if (!mapper) {
      return;
    }

    const database = configureDatabaseResults([
      [],
      [
        {
          email: "first.last+course@googlemail.com",
          image: null,
          name: "Existing Student Name",
          userId: "paid-user",
        },
      ],
    ]);
    const mappedProfile = await mapper({
      ...GOOGLE_PROFILE,
      email: "first.last@gmail.com",
    });

    expect(mappedProfile).toEqual({
      email: "first.last+course@googlemail.com",
      image: GOOGLE_PROFILE.picture,
      name: "Existing Student Name",
    });
    expect(
      new PgDialect().sqlToQuery(database.whereConditions[1] as SQL)
    ).toMatchObject({
      params: ["firstlast@gmail.com"],
      sql: expect.stringContaining("canonicalize_auth_email_identity"),
    });
  });

  it("queries the canonical identity when Google omits a buyer's plus tag", async () => {
    const options = await getAuthOptions(
      authEnvironment({
        GOOGLE_CLIENT_ID: "google-client-id-fixture",
        GOOGLE_CLIENT_SECRET: "google-client-secret-fixture",
      })
    );
    const mapper = getGoogleProfileMapper(options);
    expect(mapper).not.toBeNull();
    if (!mapper) {
      return;
    }

    const database = configureDatabaseResults([
      [],
      [
        {
          email: "first.last+course@googlemail.com",
          image: null,
          name: "Existing Student Name",
          userId: "paid-user",
        },
      ],
    ]);
    const mappedProfile = await mapper({
      ...GOOGLE_PROFILE,
      email: "first.last@gmail.com",
    });

    expect(mappedProfile).toEqual({
      email: "first.last+course@googlemail.com",
      image: GOOGLE_PROFILE.picture,
      name: "Existing Student Name",
    });
    expect(
      new PgDialect().sqlToQuery(database.whereConditions[1] as SQL)
    ).toMatchObject({
      params: ["firstlast@gmail.com"],
      sql: expect.stringContaining("canonicalize_auth_email_identity"),
    });
  });

  it("does not replace an image already chosen on the local account", async () => {
    const options = await getAuthOptions(
      authEnvironment({
        GOOGLE_CLIENT_ID: "google-client-id-fixture",
        GOOGLE_CLIENT_SECRET: "google-client-secret-fixture",
      })
    );
    const mapper = getGoogleProfileMapper(options);
    expect(mapper).not.toBeNull();
    if (!mapper) {
      return;
    }

    configureDatabaseResults([
      [],
      [
        {
          email: "firstlast@gmail.com",
          image: "https://hub.example.test/custom-avatar.png",
          name: "Existing Student Name",
          userId: "paid-user",
        },
      ],
    ]);

    await expect(mapper(GOOGLE_PROFILE)).resolves.toEqual({
      email: "firstlast@gmail.com",
      image: "https://hub.example.test/custom-avatar.png",
      name: "Existing Student Name",
    });
  });

  it("fails closed when canonical email candidates point at multiple accounts", async () => {
    const options = await getAuthOptions(
      authEnvironment({
        GOOGLE_CLIENT_ID: "google-client-id-fixture",
        GOOGLE_CLIENT_SECRET: "google-client-secret-fixture",
      })
    );
    const mapper = getGoogleProfileMapper(options);
    expect(mapper).not.toBeNull();
    if (!mapper) {
      return;
    }

    configureDatabaseResults([
      [],
      [
        { email: "firstlast@gmail.com", userId: "paid-user" },
        { email: "first.last+course@googlemail.com", userId: "signup-user" },
      ],
    ]);
    const mappedProfile = await mapper(GOOGLE_PROFILE);

    expect(mappedProfile).toEqual({ email: null });
    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "google_email_candidate_ambiguous",
        operation: "auth.google_profile_mapping",
        outcome: "failure",
        provider: "database",
      })
    );
    expect(
      JSON.stringify(dependencies.logOperationalEvent.mock.calls)
    ).not.toContain(GOOGLE_PROFILE.email);
  });
});
