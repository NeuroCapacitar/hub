import { describe, expect, it } from "vitest";
import { getSafeAuthReturnTo } from "./auth-return-to";

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
