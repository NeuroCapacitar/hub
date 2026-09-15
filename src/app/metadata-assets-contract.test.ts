import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("metadata asset contract", () => {
  it("declares the reconciled favicon formats in the root metadata", async () => {
    const source = await readFile(
      new URL("./layout.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('url: "/favicon/favicon.svg"');
    expect(source).toContain('url: "/favicon/favicon-96x96.png"');
    expect(source).toContain('url: "/favicon/favicon.ico"');
    expect(source).toContain('shortcut: "/favicon/favicon.ico"');
  });

  it("keeps every referenced favicon asset present", async () => {
    for (const asset of [
      "../../public/favicon/favicon.svg",
      "../../public/favicon/favicon-96x96.png",
      "../../public/favicon/favicon.ico",
    ]) {
      await expect(
        access(new URL(asset, import.meta.url))
      ).resolves.toBeUndefined();
    }
  });
});
