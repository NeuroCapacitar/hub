import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  captureRequestError: vi.fn(),
  getServerEnv: vi.fn(),
  getSentryOptions: vi.fn(),
  init: vi.fn(),
  isSentryRuntimeEnabled: vi.fn(
    ({ dsn }: { dsn: string | undefined }) =>
      process.env.NODE_ENV === "production" && Boolean(dsn)
  ),
  logRequestFailure: vi.fn(),
  resolveSentryRelease: vi.fn(),
  setTag: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureRequestError: dependencies.captureRequestError,
  init: dependencies.init,
  withScope: (
    callback: (scope: { setTag: typeof dependencies.setTag }) => void
  ) => callback({ setTag: dependencies.setTag }),
}));
vi.mock("./lib/request-error", () => ({
  logRequestFailure: dependencies.logRequestFailure,
}));
vi.mock("./lib/env", () => ({
  getServerEnv: dependencies.getServerEnv,
}));
vi.mock("./lib/sentry-deployment", () => ({
  isSentryRuntimeEnabled: dependencies.isSentryRuntimeEnabled,
  resolveSentryRelease: dependencies.resolveSentryRelease,
}));
vi.mock("./lib/sentry-options", () => ({
  getSentryOptions: dependencies.getSentryOptions,
}));

import { onRequestError, register } from "./instrumentation";

const TEST_SENTRY_DSN = "https://public@example.test/1";

const setEnvironmentValue = (
  key: "NEXT_RUNTIME" | "NODE_ENV" | "SENTRY_DSN" | "VERCEL_TARGET_ENV",
  value: string | undefined
): void => {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, key);
    return;
  }
  Reflect.set(process.env, key, value);
};

const snapshotEnvironment = () => ({
  NEXT_RUNTIME: process.env.NEXT_RUNTIME,
  NODE_ENV: process.env.NODE_ENV,
  SENTRY_DSN: process.env.SENTRY_DSN,
  VERCEL_TARGET_ENV: process.env.VERCEL_TARGET_ENV,
});

const restoreEnvironment = (
  snapshot: ReturnType<typeof snapshotEnvironment>
): void => {
  for (const [key, value] of Object.entries(snapshot)) {
    setEnvironmentValue(key as keyof typeof snapshot, value);
  }
};

describe("instrumentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates the environment and initializes Sentry in the Node startup context", async () => {
    const snapshot = snapshotEnvironment();
    setEnvironmentValue("NEXT_RUNTIME", "nodejs");
    setEnvironmentValue("NODE_ENV", "production");
    setEnvironmentValue("SENTRY_DSN", TEST_SENTRY_DSN);
    setEnvironmentValue("VERCEL_TARGET_ENV", "production");
    dependencies.resolveSentryRelease.mockReturnValue("a".repeat(40));
    dependencies.getSentryOptions.mockReturnValue({ enabled: true });

    try {
      await register();
    } finally {
      restoreEnvironment(snapshot);
    }

    expect(dependencies.getServerEnv).toHaveBeenCalledOnce();
    expect(dependencies.getSentryOptions).toHaveBeenCalledWith(
      TEST_SENTRY_DSN,
      "production",
      "a".repeat(40)
    );
    expect(dependencies.init).toHaveBeenCalledWith({ enabled: true });
  });

  it("initializes Sentry with Edge-safe options in the Edge startup context", async () => {
    const snapshot = snapshotEnvironment();
    setEnvironmentValue("NEXT_RUNTIME", "edge");
    setEnvironmentValue("NODE_ENV", "production");
    setEnvironmentValue("SENTRY_DSN", TEST_SENTRY_DSN);
    setEnvironmentValue("VERCEL_TARGET_ENV", "production");
    dependencies.resolveSentryRelease.mockReturnValue("b".repeat(40));
    dependencies.getSentryOptions.mockReturnValue({ enabled: true });

    try {
      await register();
    } finally {
      restoreEnvironment(snapshot);
    }

    expect(dependencies.getServerEnv).not.toHaveBeenCalled();
    expect(dependencies.getSentryOptions).toHaveBeenCalledWith(
      TEST_SENTRY_DSN,
      "production",
      "b".repeat(40)
    );
    expect(dependencies.init).toHaveBeenCalledWith({ enabled: true });
  });

  it("does not initialize or capture Sentry in local Development", async () => {
    const snapshot = snapshotEnvironment();
    setEnvironmentValue("NEXT_RUNTIME", "nodejs");
    setEnvironmentValue("NODE_ENV", "development");
    setEnvironmentValue("SENTRY_DSN", undefined);
    setEnvironmentValue("VERCEL_TARGET_ENV", undefined);

    try {
      await register();
      onRequestError(
        new Error("local failure"),
        { headers: {}, method: "GET", path: "/" },
        {} as never
      );
    } finally {
      restoreEnvironment(snapshot);
    }

    expect(dependencies.getServerEnv).toHaveBeenCalledOnce();
    expect(dependencies.init).not.toHaveBeenCalled();
    expect(dependencies.captureRequestError).not.toHaveBeenCalled();
  });

  it("keeps the safe correlation ID in the Sentry event scope", () => {
    const snapshot = snapshotEnvironment();
    setEnvironmentValue("NODE_ENV", "production");
    setEnvironmentValue("SENTRY_DSN", TEST_SENTRY_DSN);
    setEnvironmentValue("VERCEL_TARGET_ENV", "production");
    dependencies.logRequestFailure.mockReturnValue("correlation-123");
    const error = new Error("synthetic failure");
    const request = {
      headers: { "x-correlation-id": "correlation-123" },
      method: "GET",
      path: "/api/health/ready",
    };
    const context = {
      revalidateReason: undefined,
      routerKind: "App Router" as const,
      routePath: "/api/health/ready",
      routeType: "route" as const,
    };

    try {
      onRequestError(error, request, context);
    } finally {
      restoreEnvironment(snapshot);
    }

    expect(dependencies.setTag).toHaveBeenCalledWith(
      "correlation_id",
      "correlation-123"
    );
    expect(dependencies.captureRequestError).toHaveBeenCalledWith(
      error,
      request,
      context
    );
  });
});
