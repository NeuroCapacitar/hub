import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const authPages = [
  "../app/(auth)/cadastro/page.tsx",
  "../app/(auth)/entrar/page.tsx",
  "../app/(auth)/recuperar-senha/page.tsx",
  "../app/(auth)/redefinir-senha/page.tsx",
] as const;

const authPageSides = [
  ["../app/(auth)/entrar/page.tsx", "right"],
  ["../app/(auth)/cadastro/page.tsx", "left"],
  ["../app/(auth)/recuperar-senha/page.tsx", "left"],
  ["../app/(auth)/redefinir-senha/page.tsx", "left"],
] as const;

describe("authentication routes", () => {
  it("uses the same branded shell throughout the account-access flow", async () => {
    for (const page of authPages) {
      const source = await readFile(new URL(page, import.meta.url), "utf8");

      expect(source).toContain('from "@/components/auth-shell"');
      expect(source).toContain("<AuthShell");
    }
  });

  it("declares the approved desktop composition for each route", async () => {
    for (const [page, side] of authPageSides) {
      const source = await readFile(new URL(page, import.meta.url), "utf8");
      expect(source).toContain(`<AuthShell formSide="${side}`);
    }
  });

  it("keeps media loading and layout direction in the shared shell", async () => {
    const source = await readFile(
      new URL("./auth-shell.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('from "@/components/brand-logo"');
    expect(source).toContain('from "@/features/auth-media/auth-media-slot"');
    expect(source).toContain("<BrandLogo");
    expect(source).toContain("<Suspense");
    expect(source).toContain('formSide?: "left" | "right"');
    expect(source).toContain("lg:order-1");
    expect(source).toContain("lg:order-2");
  });

  it("keeps the auth composition as one wide, lightly framed split surface", async () => {
    const shellSource = await readFile(
      new URL("./auth-shell.tsx", import.meta.url),
      "utf8"
    );

    expect(shellSource).toContain("auth-shell-frame");
    expect(shellSource).toContain(
      "lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]"
    );
    expect(shellSource).toContain("shadow-none");
    expect(shellSource).not.toContain("lg:border-r");
    expect(shellSource).not.toContain("lg:border-l");
    expect(shellSource).not.toContain("aspect-[4/5]");
    expect(shellSource).not.toContain("max-w-[30rem] overflow-hidden");

    const globalStyles = await readFile(
      new URL("../app/globals.css", import.meta.url),
      "utf8"
    );
    expect(globalStyles).toContain(".auth-shell-frame");
    expect(globalStyles).toContain("max-width: none");
    expect(globalStyles).not.toContain("max-width: 1480px");

    for (const page of authPages) {
      const source = await readFile(new URL(page, import.meta.url), "utf8");
      expect(source).toContain("bg-transparent");
      expect(source).toContain("mx-auto w-full max-w-sm");
      expect(source).toContain("ring-0");
    }
  });
});
