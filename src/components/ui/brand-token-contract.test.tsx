import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { badgeVariants } from "./badge";
import { buttonVariants } from "./button";

describe("brand token contract", () => {
  it("keeps learning completion separate from technical success", () => {
    const classes = badgeVariants({ variant: "learning" });

    expect(classes).toContain("bg-learning-complete");
    expect(classes).toContain("text-learning-complete-foreground");
  });

  it("uses a high-contrast focus treatment on the shared button primitive", () => {
    const classes = buttonVariants({ variant: "default" });

    expect(classes).toContain("bg-button-primary");
    expect(classes).toContain("focus-visible:outline-focus");
    expect(classes).toContain("focus-visible:ring-background");
  });

  it("declares brand anchors in both dark theme scopes", async () => {
    const source = await readFile(
      new URL("../../app/globals.css", import.meta.url),
      "utf8"
    );

    expect(source.match(/--brand-orange:/g)).toHaveLength(2);
    expect(source.match(/--brand-olive:/g)).toHaveLength(2);
    expect(source).toContain("--selection:");
    expect(source).toContain("--progress-complete:");
    expect(source).toContain("--support-foreground:");
  });
});
