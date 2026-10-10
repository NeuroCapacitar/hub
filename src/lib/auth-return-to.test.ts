import { describe, expect, it } from "vitest";
import {
  getAuthSignInPath,
  getAuthSignUpPath,
  getEmailVerificationCallbackUrl,
  getGoogleOAuthCallbackUrl,
  getSafeAuthRedirectPath,
  getSafeAuthReturnTo,
} from "./auth-return-to";

describe("getSafeAuthReturnTo", () => {
  it("accepts only the canonical internal purchase path", () => {
    expect(getSafeAuthReturnTo("/comprar/curso-gratis")).toBe(
      "/comprar/curso-gratis"
    );
  });

  it.each([
    null,
    undefined,
    "",
    123,
    { returnTo: "/comprar/curso-gratis" },
    Symbol("/comprar/curso-gratis"),
  ])("rejects a non-string or empty value: %s", (value) => {
    expect(getSafeAuthReturnTo(value)).toBeNull();
  });

  it.each([
    "https://other.example/comprar/curso-gratis",
    "http://other.example/comprar/curso-gratis",
    "//other.example/comprar/curso-gratis",
    "//user:password@other.example/comprar/curso-gratis",
    "/app",
    "/admin",
    "/comprar",
    "/comprar/",
    "/comprar/curso?next=/admin",
    "/comprar/curso#fragment",
    "/comprar/curso%2Fgratis",
    "/comprar/curso\\gratis",
    "/comprar/curso\n-gratis",
    "/comprar/Curso-gratis",
    "/comprar/curso gratis",
    "/comprar/curso_gratis",
    "/comprar/curso..gratis",
    "/comprar/../admin",
  ])("rejects an unsafe return path: %s", (value) => {
    expect(getSafeAuthReturnTo(value)).toBeNull();
  });

  it("rejects a return path above the length limit", () => {
    expect(getSafeAuthReturnTo(`/comprar/${"a".repeat(248)}`)).toBeNull();
  });
});

describe("Google OAuth callback URLs", () => {
  it("uses the configured application origin and preserves only a safe return path", () => {
    expect(
      getGoogleOAuthCallbackUrl({
        appUrl: "https://hub.example.test/base/path?ignored=yes",
        returnTo: "/comprar/curso-gratis",
      })
    ).toBe(
      "https://hub.example.test/oauth/callback?returnTo=%2Fcomprar%2Fcurso-gratis"
    );
  });

  it("omits an invalid return path from the OAuth callback", () => {
    expect(
      getGoogleOAuthCallbackUrl({
        appUrl: "https://hub.example.test",
        returnTo: "https://outside.example/",
      })
    ).toBe("https://hub.example.test/oauth/callback");
  });

  it("returns email verification to sign-in with a safe purchase return path", () => {
    expect(
      getEmailVerificationCallbackUrl({
        appUrl: "https://hub.example.test",
        returnTo: "/comprar/curso-gratis",
      })
    ).toBe(
      "https://hub.example.test/entrar?emailVerified=1&returnTo=%2Fcomprar%2Fcurso-gratis"
    );
  });
});

describe("auth redirect destinations", () => {
  it("builds a sign-in path with only a safe course return path", () => {
    expect(getAuthSignInPath("/comprar/curso-gratis")).toBe(
      "/entrar?returnTo=%2Fcomprar%2Fcurso-gratis"
    );
    expect(getAuthSignInPath("https://outside.example/escape")).toBe("/entrar");
  });

  it("builds a sign-up path with only a safe course return path", () => {
    expect(getAuthSignUpPath("/comprar/curso-gratis")).toBe(
      "/cadastro?returnTo=%2Fcomprar%2Fcurso-gratis"
    );
    expect(getAuthSignUpPath("https://outside.example/escape")).toBe(
      "/cadastro"
    );
  });

  it.each([
    ["/admin", "/admin"],
    ["/comprar/curso-gratis", "/comprar/curso-gratis"],
    ["/app?tab=activity", "/app?tab=activity"],
  ])("accepts an internal post-auth destination %s", (input, expected) => {
    expect(getSafeAuthRedirectPath(input)).toBe(expected);
  });

  it.each([
    "https://outside.example/escape",
    "//outside.example/escape",
    "/\\outside.example/escape",
    "javascript:alert(1)",
    "/admin\n",
    null,
    42,
  ])("rejects an unsafe post-auth destination: %s", (value) => {
    expect(getSafeAuthRedirectPath(value)).toBeNull();
  });
});
