import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const FOCUS_EXCEPTIONS = [
  {
    file: "./accordion.tsx",
    recipe: "focus-visible:border-focus",
    forbidden: "focus-visible:ring-ring/50",
  },
  {
    file: "./slider.tsx",
    recipe: "focus-visible:border-focus",
    forbidden: "focus-visible:ring-ring/30",
  },
  {
    file: "./table.tsx",
    recipe: "focus-visible:border-focus",
    forbidden: "focus-visible:ring-ring focus-visible:ring-offset-2",
  },
  {
    file: "./sidebar.tsx",
    recipe: "focus-visible:border-sidebar-ring",
    forbidden: "focus-visible:ring-sidebar-ring",
  },
] as const;

describe("focus exception contract", () => {
  it.each(
    FOCUS_EXCEPTIONS
  )("keeps the intentional geometry-aware focus treatment in $file", async ({
    file,
    recipe,
    forbidden,
  }) => {
    const source = await readFile(new URL(file, import.meta.url), "utf8");

    expect(source).toContain(recipe);
    expect(source).not.toContain(forbidden);
  });
});
