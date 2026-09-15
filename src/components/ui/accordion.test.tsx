import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("AccordionTrigger accessibility", () => {
  it("keeps the shared focus treatment after removing the native outline", async () => {
    const source = await readFile(
      new URL("./accordion.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("outline-none");
    expect(source).toContain("focus-visible:border-focus");
    expect(source).toContain("focus-visible:outline-focus");
    expect(source).toContain(
      "focus-visible:ring-2 focus-visible:ring-background"
    );
  });

  it("does not add a redundant horizontal content inset", async () => {
    const source = await readFile(
      new URL("./accordion.tsx", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain(
      'className="overflow-hidden px-4 text-sm data-closed:animate-accordion-up data-open:animate-accordion-down"'
    );
  });
});
