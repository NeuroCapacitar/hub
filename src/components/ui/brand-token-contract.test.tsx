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

  it("keeps progress explicit while preserving the default badge contract", () => {
    const progressClasses = badgeVariants({ variant: "progress" });
    const defaultClasses = badgeVariants({ variant: "default" });

    expect(progressClasses).toContain("bg-primary");
    expect(progressClasses).toContain("text-primary-foreground");
    expect(defaultClasses).toContain("bg-primary");
  });

  it("uses a high-contrast focus treatment on the shared button primitive", () => {
    const classes = buttonVariants({ variant: "default" });

    expect(classes).toContain("bg-button-primary");
    expect(classes).toContain("focus-visible:outline-focus");
    expect(classes).toContain("focus-visible:ring-background");
  });

  it("keeps the orange Button accent opt-in", () => {
    const defaultClasses = buttonVariants({ variant: "default" });
    const accentClasses = buttonVariants({ variant: "accent" });

    expect(accentClasses).toContain("bg-primary");
    expect(accentClasses).toContain("text-primary-foreground");
    expect(accentClasses).toContain("color-mix");
    expect(defaultClasses).toContain("bg-button-primary");
    expect(defaultClasses).not.toContain("bg-primary");
  });

  it("declares brand anchors in both dark theme scopes", async () => {
    const source = await readFile(
      new URL("../../app/globals.css", import.meta.url),
      "utf8"
    );

    expect(source.match(/--brand-orange:/g)).toHaveLength(2);
    expect(source.match(/--brand-olive:/g)).toHaveLength(2);
    expect(source).toContain("--text-selection:");
    expect(source).toContain("--control-selected:");
    expect(source).toContain("--progress-complete:");
    expect(source).toContain("--support-foreground:");
    expect(source.match(/--slider-thumb:/g)).toHaveLength(2);
    expect(source).toContain(
      "--slider-thumb: var(--control-selected-foreground);"
    );
    expect(
      source.match(/--border: oklch\(0\.495 0\.035 202\.9 \/ 0\.24\);/g)
    ).toHaveLength(2);
    expect(
      source.match(/--input: oklch\(0\.495 0\.035 202\.9 \/ 0\.3\);/g)
    ).toHaveLength(2);
  });

  it("keeps the Slider thumb independent from primary foreground", async () => {
    const source = await readFile(
      new URL("./slider.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("bg-slider-thumb");
    expect(source).not.toContain("bg-primary-foreground");
  });

  it("keeps inactive sidebar navigation quieter than active navigation", async () => {
    const source = await readFile(
      new URL("./sidebar.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('"text-muted-foreground"');
    expect(source).toContain("data-active:bg-sidebar-accent");
    expect(source).toContain("data-active:text-sidebar-accent-foreground");
  });

  it("keeps rich-text links on the functional link token", async () => {
    const source = await readFile(
      new URL("../../styles/lesson-rich-text.css", import.meta.url),
      "utf8"
    );

    expect(source).toContain("color: var(--link)");
    expect(source).not.toContain("color: var(--primary)");
  });
});
