import { describe, expect, it } from "vitest";
import { resolveGoogleEmailCandidate } from "@/lib/email-identity";
import { parseBuyerIdentity } from "./buyer-identity";

describe("parseBuyerIdentity", () => {
  it("normalizes a valid buyer identity", () => {
    expect(
      parseBuyerIdentity({
        email: " Buyer@Example.COM ",
        name: " Compradora Exemplo ",
      })
    ).toEqual({
      email: "buyer@example.com",
      name: "Compradora Exemplo",
    });
  });

  it.each([
    [" First.Last+course@googlemail.com ", "firstlast@gmail.com"],
    ["First.Last+course@gmail.com", "firstlast@gmail.com"],
    ["Buyer+course@outlook.com", "buyer@outlook.com"],
  ])("matches the Better Auth Sentinel identity for %s", (email, normalizedEmail) => {
    expect(parseBuyerIdentity({ email, name: "Compradora" })).toEqual({
      email: normalizedEmail,
      name: "Compradora",
    });
  });

  it.each([
    "buyer",
    "buyer@example",
    "buyer @example.com",
    "buyer\n@example.com",
    "buyer@@example.com",
  ])("rejects an invalid email: %s", (email) => {
    expect(parseBuyerIdentity({ email, name: "Compradora" })).toBeNull();
  });

  it("rejects non-object values and non-string fields", () => {
    const invalidValues = [
      null,
      undefined,
      "buyer@example.com",
      [],
      { email: 42, name: "Compradora" },
      { email: "buyer@example.com", name: 42 },
    ];

    for (const value of invalidValues) {
      expect(parseBuyerIdentity(value)).toBeNull();
    }
  });

  it("rejects an empty name after trimming", () => {
    expect(
      parseBuyerIdentity({ email: "buyer@example.com", name: "   " })
    ).toBeNull();
  });

  it("preserves the checkout email length limits", () => {
    const maximumLocalPart = "a".repeat(64);
    const maximumEmail = `${maximumLocalPart}@${"b".repeat(63)}.${"c".repeat(
      63
    )}.${"d".repeat(57)}.com`;

    expect(
      parseBuyerIdentity({ email: maximumEmail, name: "Compradora" })
    ).toEqual({ email: maximumEmail, name: "Compradora" });
    expect(
      parseBuyerIdentity({
        email: `${"a".repeat(65)}@example.com`,
        name: "Compradora",
      })
    ).toBeNull();
    expect(
      parseBuyerIdentity({ email: `${maximumEmail}x`, name: "Compradora" })
    ).toBeNull();
  });

  it("preserves the checkout name length limit in Unicode code points", () => {
    expect(
      parseBuyerIdentity({
        email: "buyer@example.com",
        name: "\u{1f9d1}".repeat(120),
      })
    ).toEqual({
      email: "buyer@example.com",
      name: "\u{1f9d1}".repeat(120),
    });
    expect(
      parseBuyerIdentity({
        email: "buyer@example.com",
        name: "\u{1f9d1}".repeat(121),
      })
    ).toBeNull();
  });
});

describe("Google account email reconciliation", () => {
  it("accepts one exact or buyer-canonical local identity and rejects ambiguity", () => {
    expect(
      resolveGoogleEmailCandidate({
        googleEmail: "Buyer@Example.com",
        candidates: [{ userId: "user-1", email: "buyer@example.com" }],
      })
    ).toEqual({ kind: "unique", userId: "user-1" });

    expect(
      resolveGoogleEmailCandidate({
        googleEmail: "First.Last+course@googlemail.com",
        candidates: [{ userId: "user-2", email: "firstlast@gmail.com" }],
      })
    ).toEqual({ kind: "unique", userId: "user-2" });

    expect(
      resolveGoogleEmailCandidate({
        googleEmail: "Buyer+course@outlook.com",
        candidates: [
          { userId: "user-3", email: "buyer@outlook.com" },
          { userId: "user-4", email: "BUYER+course@outlook.com" },
        ],
      })
    ).toEqual({ kind: "ambiguous" });

    expect(
      resolveGoogleEmailCandidate({
        googleEmail: "new@example.com",
        candidates: [],
      })
    ).toEqual({ kind: "none" });
  });
});
