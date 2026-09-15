import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("design system preview coverage", () => {
  it("keeps the high-risk controls and surfaces visible in the fixture", async () => {
    const source = await readFile(
      new URL("./design-system-preview.tsx", import.meta.url),
      "utf8"
    );

    for (const control of [
      "Checkbox",
      "RadioGroupItem",
      "Switch",
      "Slider",
      "Select",
      "Textarea",
    ]) {
      expect(source).toContain(control);
    }

    for (const primitive of [
      "Alert",
      "Empty",
      "DropdownMenu",
      "Dialog",
      "Table",
      "Avatar",
      "preview-upload",
    ]) {
      expect(source).toContain(primitive);
    }

    expect(source).toContain('variant="progress"');

    for (const surface of [
      "bg-background",
      "bg-card",
      "bg-sidebar",
      "text-support-foreground",
      "border-focus",
      "bg-control-selected",
    ]) {
      expect(source).toContain(surface);
    }
  });
});
