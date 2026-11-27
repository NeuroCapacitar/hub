import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./content-security-policy";

describe("content security policy", () => {
  it("restricts connections to the application, Sentry ingest and JMVStream upload storage", () => {
    expect(
      buildContentSecurityPolicy({
        additionalConnectOrigins: [],
        isProduction: true,
      })
    ).toContain(
      "connect-src 'self' https://*.ingest.us.sentry.io https://s3.jmvstream.com;"
    );
  });

  it("frames only the application and the JMVStream player", () => {
    expect(
      buildContentSecurityPolicy({
        additionalConnectOrigins: [],
        isProduction: true,
      })
    ).toContain("frame-src 'self' https://player.jmvstream.com");
  });

  it("allows a validated E2E object-storage origin without changing other directives", () => {
    const policy = buildContentSecurityPolicy({
      additionalConnectOrigins: ["http://127.0.0.1:4568"],
      isProduction: true,
    });

    expect(policy).toContain(
      "connect-src 'self' https://*.ingest.us.sentry.io https://s3.jmvstream.com http://127.0.0.1:4568"
    );
    expect(policy).toContain("upgrade-insecure-requests");
  });
});
