import { describe, expect, it } from "vitest";
import {
  createEmailChallengeToken,
  verifyEmailChallengeToken,
} from "./email-challenge-token";

const CHALLENGE = {
  challengeId: "3adcf1b8-37e9-4e50-9d5b-071e6b8b743b",
  expiresAt: new Date("2026-10-01T12:00:00.000Z"),
  generation: 2,
  purpose: "verify_email" as const,
  secret: "test-only-auth-secret",
};

describe("email challenge token", () => {
  it("creates a stable opaque token bound to one challenge generation and purpose", () => {
    const first = createEmailChallengeToken(CHALLENGE);
    const repeated = createEmailChallengeToken(CHALLENGE);
    const otherPurpose = createEmailChallengeToken({
      ...CHALLENGE,
      purpose: "signup",
    });

    expect(first).toBe(repeated);
    expect(first).not.toContain("test-only-auth-secret");
    expect(first).not.toContain("student@example.test");
    expect(first).not.toBe(otherPurpose);
    expect(
      verifyEmailChallengeToken({
        now: new Date("2026-10-01T11:59:59.000Z"),
        purpose: "verify_email",
        secret: CHALLENGE.secret,
        token: first,
      })
    ).toEqual({
      challengeId: CHALLENGE.challengeId,
      expiresAt: CHALLENGE.expiresAt,
      generation: CHALLENGE.generation,
      purpose: CHALLENGE.purpose,
    });
  });

  it("rejects expiry, purpose mismatch, wrong secret, and tampering", () => {
    const token = createEmailChallengeToken(CHALLENGE);

    expect(
      verifyEmailChallengeToken({
        now: CHALLENGE.expiresAt,
        purpose: CHALLENGE.purpose,
        secret: CHALLENGE.secret,
        token,
      })
    ).toBeNull();
    expect(
      verifyEmailChallengeToken({
        now: new Date("2026-10-01T11:00:00.000Z"),
        purpose: "change_email",
        secret: CHALLENGE.secret,
        token,
      })
    ).toBeNull();
    expect(
      verifyEmailChallengeToken({
        now: new Date("2026-10-01T11:00:00.000Z"),
        purpose: CHALLENGE.purpose,
        secret: "another-secret",
        token,
      })
    ).toBeNull();
    const signatureStart = token.lastIndexOf(".") + 1;
    const changedSignature = token[signatureStart] === "A" ? "B" : "A";
    const tamperedToken =
      token.slice(0, signatureStart) +
      changedSignature +
      token.slice(signatureStart + 1);
    expect(
      verifyEmailChallengeToken({
        now: new Date("2026-10-01T11:00:00.000Z"),
        purpose: CHALLENGE.purpose,
        secret: CHALLENGE.secret,
        token: tamperedToken,
      })
    ).toBeNull();
    expect(
      verifyEmailChallengeToken({
        now: new Date("2026-10-01T11:00:00.000Z"),
        purpose: CHALLENGE.purpose,
        secret: CHALLENGE.secret,
        token: "not-a-token",
      })
    ).toBeNull();
  });

  it("rejects an invalid verification clock instead of accepting a challenge", () => {
    const token = createEmailChallengeToken(CHALLENGE);

    expect(
      verifyEmailChallengeToken({
        now: new Date(Number.NaN),
        purpose: CHALLENGE.purpose,
        secret: CHALLENGE.secret,
        token,
      })
    ).toBeNull();
  });
});
