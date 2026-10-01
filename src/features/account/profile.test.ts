import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
  getActiveEmailChangeSummary: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("./email-change", () => ({
  getActiveEmailChangeSummary: dependencies.getActiveEmailChangeSummary,
}));

import { getAccountSecuritySummary } from "./profile";

describe("account security summary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.getActiveEmailChangeSummary.mockResolvedValue(null);
  });

  it("returns only the current user's sign-in methods and avatar options", async () => {
    const query = vi.fn((statement: string, values: unknown[] = []) => {
      expect(values[0]).toBe("student-1");
      if (statement.includes("has_google_account")) {
        return Promise.resolve({
          rows: [
            {
              has_google_account: true,
            },
          ],
        });
      }
      return Promise.resolve({
        rows: [
          {
            avatar_mode: "custom",
            google_image_available: true,
          },
        ],
      });
    });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.getActiveEmailChangeSummary.mockResolvedValue({
      expiresAt: new Date("2026-09-29T16:00:00.000Z"),
      newEmail: "new@example.test",
      status: "pending_new",
    });

    await expect(getAccountSecuritySummary("student-1")).resolves.toEqual({
      avatarMode: "custom",
      googleImageAvailable: true,
      hasGoogleAccount: true,
      pendingEmailChange: {
        expiresAt: new Date("2026-09-29T16:00:00.000Z"),
        newEmail: "new@example.test",
        status: "pending_new",
      },
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(
      query.mock.calls.every(([, values]) => values?.[0] === "student-1")
    ).toBe(true);
    expect(String(query.mock.calls[0]?.[0])).not.toContain("credential");
    expect(String(query.mock.calls[0]?.[0])).not.toContain("password");
  });

  it("uses safe defaults for accounts without linked methods or avatar settings", async () => {
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({ rows: [] }),
    });

    await expect(getAccountSecuritySummary("student-1")).resolves.toEqual({
      avatarMode: "initials",
      googleImageAvailable: false,
      hasGoogleAccount: false,
      pendingEmailChange: null,
    });
  });
});
