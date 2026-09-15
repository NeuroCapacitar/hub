import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const FOCUS_RECIPE = [
  "focus-visible:border-focus",
  "focus-visible:outline-2",
  "focus-visible:outline-focus",
  "focus-visible:outline-offset-2",
  "focus-visible:ring-2",
  "focus-visible:ring-background",
] as const;

const FOCUS_CONSUMERS = [
  "./checkbox.tsx",
  "./radio-group.tsx",
  "./resource-list.tsx",
  "./select.tsx",
  "./switch.tsx",
  "./textarea.tsx",
] as const;

describe("focus token contract", () => {
  it.each(
    FOCUS_CONSUMERS
  )("uses the canonical focus recipe in %s", async (relativePath) => {
    const source = await readFile(
      new URL(relativePath, import.meta.url),
      "utf8"
    );

    for (const className of FOCUS_RECIPE) {
      expect(source).toContain(className);
    }

    expect(source).not.toContain("focus-visible:ring-3");
    expect(source).not.toContain("focus-visible:ring-ring");
  });
});
