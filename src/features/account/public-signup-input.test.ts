import { describe, expect, it } from "vitest";
import { parsePublicSignupInput } from "./public-signup-input";

describe("public signup input", () => {
  it("accepts only name, email, and a safe course return path", () => {
    expect(
      parsePublicSignupInput({
        email: "student@example.test",
        name: "  Student Example  ",
        returnTo: "/comprar/curso-teste",
      })
    ).toEqual({
      courseSlug: "curso-teste",
      email: "student@example.test",
      name: "Student Example",
    });
  });

  it("rejects password collection and untrusted redirects", () => {
    expect(
      parsePublicSignupInput({
        email: "student@example.test",
        name: "Student Example",
        password: "attacker-chosen-password",
      })
    ).toBeNull();
    expect(
      parsePublicSignupInput({
        email: "student@example.test",
        name: "Student Example",
        returnTo: "https://attacker.example.test",
      })
    ).toBeNull();
  });

  it.each([
    null,
    [],
    {},
    { email: "invalid", name: "Student" },
    { email: "student@example.test", name: "   " },
    { email: "student@example.test", name: "Student".repeat(20) },
  ])("rejects malformed signup payloads: %s", (input) => {
    expect(parsePublicSignupInput(input)).toBeNull();
  });
});
