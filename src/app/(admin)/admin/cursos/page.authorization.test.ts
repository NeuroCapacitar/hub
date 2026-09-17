import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("course catalog authorization", () => {
  it("requires course visibility directly on the page", async () => {
    const source = await readFile(
      new URL("./page.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('requirePermission("viewCourses")');
    expect(source).not.toContain('requireRole(["admin", "support"])');
  });
});
