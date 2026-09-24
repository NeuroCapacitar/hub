import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("PanelLayout", () => {
  it("does not present fabricated notifications in the shared app header", async () => {
    const source = await readFile(
      new URL("./panel-layout.tsx", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain('from "@/components/notifications-button"');
    expect(source).not.toContain("<NotificationsButton />");
  });

  it("keeps the official platform logo in desktop and mobile headers", async () => {
    const source = await readFile(
      new URL("./panel-layout.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('from "@/components/brand-logo"');
    expect(source).toContain("<BrandLogo");
  });

  it("keeps a shell title for compact pages and uses ancestor breadcrumbs for headed pages", async () => {
    const source = await readFile(
      new URL("./panel-layout.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("getPanelRouteMeta(pathname,");
    expect(source).toContain("studentDashboardGreeting");
    expect(source).toContain("<PanelBreadcrumb");
    expect(source).toContain("hasVisiblePageHeading");
    expect(source).toContain("currentTitle: pageMeta.title");
    expect(source).toContain("pageMeta.mobilePageHeading");
    expect(source).toContain("{pageMeta.title}");
  });
});
