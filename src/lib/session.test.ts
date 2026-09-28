import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getAuth: vi.fn(),
  getDb: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`redirect:${destination}`);
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("next/navigation", () => ({ redirect: dependencies.redirect }));
vi.mock("@/db", () => ({ getDb: dependencies.getDb }));
vi.mock("@/lib/auth", () => ({ getAuth: dependencies.getAuth }));

import { getCurrentSession, recordLastAccess, requireRole } from "./session";

const setDatabaseIdentity = (
  role: "admin" | "student" | "support",
  userImage: string | null = null
) => {
  const limit = vi.fn().mockResolvedValue([
    {
      platformBlockedAt: null,
      platformBlockedReason: null,
      role,
      userImage,
    },
  ]);
  dependencies.getDb.mockReturnValue({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({ limit })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    })),
  });
};

describe("requireRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getAuth.mockReturnValue({
      api: {
        getSession: vi.fn().mockResolvedValue({
          user: {
            email: "staff@example.com",
            id: "staff-user",
            name: "Staff User",
          },
        }),
      },
    });
  });

  it("allows an authenticated admin session", async () => {
    setDatabaseIdentity("admin");

    await expect(requireRole(["admin", "support"])).resolves.toMatchObject({
      role: "admin",
    });
  });

  it("allows an authenticated support session", async () => {
    setDatabaseIdentity("support");

    await expect(requireRole(["admin", "support"])).resolves.toMatchObject({
      role: "support",
    });
  });

  it("allows an authenticated student session", async () => {
    setDatabaseIdentity("student");

    await expect(requireRole(["student"])).resolves.toMatchObject({
      role: "student",
    });
  });
});

describe("getCurrentSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getAuth.mockReturnValue({
      api: {
        getSession: vi.fn().mockResolvedValue({
          user: {
            email: "student@example.com",
            id: "student-user",
            name: "Student User",
          },
        }),
      },
    });
  });

  it("includes the persisted user image in the app session", async () => {
    setDatabaseIdentity("student", "https://images.example.test/student.jpg");

    await expect(getCurrentSession()).resolves.toMatchObject({
      user: { image: "https://images.example.test/student.jpg" },
    });
  });
});

describe("recordLastAccess", () => {
  it("updates the profile access timestamp for any authenticated role", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    dependencies.getDb.mockReturnValue({ update });

    await recordLastAccess("staff-1");

    expect(update).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith({ lastAccessAt: expect.any(Date) });
    expect(where).toHaveBeenCalledOnce();
  });
});
