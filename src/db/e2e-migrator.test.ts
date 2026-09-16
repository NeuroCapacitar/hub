import { createHash } from "node:crypto";
import type { MigrationMeta } from "drizzle-orm/migrator";
import { describe, expect, it, vi } from "vitest";
import {
  applyMigrationsPerFile,
  hasExecutableMigrationSql,
} from "./e2e-migrator";

const migration = (
  folderMillis: number,
  hash: string,
  sql: string[]
): MigrationMeta => ({ bps: true, folderMillis, hash, sql });

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

describe("E2E per-file migrator", () => {
  it("commits every file separately and journals comment-only baselines", async () => {
    const events: string[] = [];
    const client = {
      query: vi.fn((statement: string) => {
        const normalized = statement.trim().replaceAll(/\s+/g, " ");
        events.push(normalized);
        return normalized.startsWith("select hash")
          ? { rows: [] }
          : { rows: [] };
      }),
    };

    await applyMigrationsPerFile({
      client: client as never,
      migrations: [
        migration(1, "hash-1", ["select 1"]),
        migration(2, "hash-2", ["-- snapshot baseline only\n"]),
      ],
    });

    expect(events.filter((event) => event === "begin")).toHaveLength(2);
    expect(events.filter((event) => event === "commit")).toHaveLength(2);
    expect(events).not.toContain("-- snapshot baseline only");
    expect(
      events.filter((event) => event.startsWith("insert into drizzle"))
    ).toHaveLength(2);
  });

  it("rolls back the current file when a statement fails", async () => {
    const events: string[] = [];
    const client = {
      query: vi.fn((statement: string) => {
        const normalized = statement.trim().replaceAll(/\s+/g, " ");
        events.push(normalized);
        if (normalized === "invalid statement") {
          throw new Error("migration failed");
        }
        return { rows: [] };
      }),
    };

    await expect(
      applyMigrationsPerFile({
        client: client as never,
        migrations: [migration(1, "hash-1", ["invalid statement"])],
      })
    ).rejects.toThrow("migration failed");
    expect(events.at(-1)).toBe("rollback");
  });

  it("rejects a journal hash that differs from the local migration", async () => {
    const client = {
      query: vi.fn(async (statement: string) => ({
        rows: statement.trim().startsWith("select hash")
          ? [{ created_at: "1", hash: "other" }]
          : [],
      })),
    };

    await expect(
      applyMigrationsPerFile({
        client: client as never,
        migrations: [migration(1, "hash-1", ["select 1"])],
      })
    ).rejects.toThrow("Migration journal drift at 1");
  });

  it("accepts a historical hash that differs only by line endings", async () => {
    const sql = "create table example (id integer);\nselect 1;\n";
    const client = {
      query: vi.fn(async (statement: string) => ({
        rows: statement.trim().startsWith("select hash")
          ? [
              {
                created_at: "1",
                hash: sha256(sql.replaceAll("\n", "\r\n")),
              },
            ]
          : [],
      })),
    };

    await expect(
      applyMigrationsPerFile({
        client: client as never,
        migrations: [migration(1, sha256(sql), [sql])],
      })
    ).resolves.toBeUndefined();
  });

  it("can continue from a Development journal with historical hash drift", async () => {
    const client = {
      query: vi.fn(async (statement: string) => ({
        rows: statement.trim().startsWith("select hash")
          ? [{ created_at: "1", hash: "other" }]
          : [],
      })),
    };

    await expect(
      applyMigrationsPerFile({
        client: client as never,
        migrations: [migration(1, "hash-1", ["select 1"])],
        verifyAppliedHashes: false,
      })
    ).resolves.toBeUndefined();
  });

  it("still rejects an unknown journal timestamp when hashes are not verified", async () => {
    const client = {
      query: vi.fn(async (statement: string) => ({
        rows: statement.trim().startsWith("select hash")
          ? [{ created_at: "2", hash: "other" }]
          : [],
      })),
    };

    await expect(
      applyMigrationsPerFile({
        client: client as never,
        migrations: [migration(1, "hash-1", ["select 1"])],
        verifyAppliedHashes: false,
      })
    ).rejects.toThrow("Migration journal drift at 2");
  });

  it("recognizes blank and line-comment-only statements", () => {
    expect(hasExecutableMigrationSql("\n-- baseline\n  -- retained\n")).toBe(
      false
    );
    expect(hasExecutableMigrationSql("-- context\nselect 1")).toBe(true);
  });
});
