import { readFile } from "node:fs/promises";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { authMediaSlides } from "./schema";

const tableConfig = getTableConfig(authMediaSlides);

describe("authentication media persistence contract", () => {
  it("stores only the fields needed for ordered decorative slides", () => {
    expect(tableConfig.columns.map((column) => column.name)).toEqual([
      "blur_data_url",
      "id",
      "image_url",
      "is_active",
      "sort_order",
      "created_at",
      "updated_at",
    ]);
    expect(tableConfig.checks.map((constraint) => constraint.name)).toEqual(
      expect.arrayContaining([
        "auth_media_slides_image_url_prefix_check",
        "auth_media_slides_sort_order_positive_check",
      ])
    );
    expect(
      tableConfig.indexes.map((tableIndex) => tableIndex.config.name)
    ).toContain("auth_media_slides_active_order_idx");
    expect(
      tableConfig.uniqueConstraints.map((constraint) => constraint.name)
    ).toContain("auth_media_slides_sort_order_unique");
  });

  it("creates the table with the same storage invariants", async () => {
    const migration = await readFile(
      new URL("./migrations/0080_auth_media_slides.sql", import.meta.url),
      "utf8"
    );

    expect(migration).toContain('CREATE TABLE "auth_media_slides"');
    expect(migration).toContain('"auth_media_slides_image_url_prefix_check"');
    expect(migration).toContain(
      '"auth_media_slides_sort_order_positive_check"'
    );
    expect(migration).toContain('"auth_media_slides_sort_order_unique"');
    expect(migration).toContain('"auth_media_slides_active_order_idx"');
  });
});
