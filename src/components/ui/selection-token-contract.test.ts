import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const CONTROL_SELECTION_CONSUMERS = [
  "./calendar.tsx",
  "./checkbox.tsx",
  "./radio-group.tsx",
  "./slider.tsx",
  "./switch.tsx",
] as const;

describe("selection token contract", () => {
  it("keeps text selection separate from control selection", async () => {
    const source = await readFile(
      new URL("../../app/globals.css", import.meta.url),
      "utf8"
    );

    expect(source).toContain("background: var(--text-selection);");
    expect(source).toContain("color: var(--text-selection-foreground);");
    expect(source).toContain("--selection: var(--control-selected);");
    expect(source).toContain(
      "--selection-foreground: var(--control-selected-foreground);"
    );
  });

  it("keeps selection surfaces opaque for reliable contrast", async () => {
    const source = await readFile(
      new URL("../../app/globals.css", import.meta.url),
      "utf8"
    );

    expect(
      source.match(/--text-selection: oklch\(0\.675 0\.143 54\);/g)
    ).toHaveLength(2);
    expect(
      source.match(/--control-selected: oklch\(0\.675 0\.143 54\);/g)
    ).toHaveLength(2);
  });

  it.each(
    CONTROL_SELECTION_CONSUMERS
  )("uses control selection tokens in %s", async (relativePath) => {
    const source = await readFile(
      new URL(relativePath, import.meta.url),
      "utf8"
    );

    expect(source).toContain("control-selected");
    expect(source).not.toContain("bg-selection");
    expect(source).not.toContain("text-selection-foreground");
  });
});
