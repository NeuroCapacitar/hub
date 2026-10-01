import { beforeEach, describe, expect, it, vi } from "vitest";

const PRIVATE_AVATAR_URL_PATTERN =
  /^\/api\/account\/avatar\?revision=[A-Za-z0-9_-]+$/;

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

import {
  getCurrentSession,
  recordLastAccess,
  requireAccountSession,
  requireRole,
  requireSession,
} from "./session";

const setDatabaseIdentity = (
  role: "admin" | "student" | "support",
  userImage: string | null = null,
  platformBlockedAt: Date | null = null,
  emailVerified = true,
  avatarMode: "custom" | "google" | "initials" = "google",
  avatarKey: string | null = null
) => {
  const limit = vi.fn().mockResolvedValue([
    {
      avatarKey,
      avatarMode,
      emailVerified,
      platformBlockedAt,
      platformBlockedReason: null,
      role,
      supportPermissionGrants: [],
      supportPermissionViews: [],
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
          session: { createdAt: new Date() },
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
          session: { createdAt: new Date() },
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

  it("uses a Google image automatically when no custom photo is selected", async () => {
    setDatabaseIdentity(
      "student",
      "https://images.example.test/student.jpg",
      null,
      true,
      "initials"
    );

    await expect(getCurrentSession()).resolves.toMatchObject({
      user: { image: "https://images.example.test/student.jpg" },
    });
  });

  it("prefers the private custom avatar over the Google image", async () => {
    setDatabaseIdentity(
      "student",
      "https://images.example.test/student.jpg",
      null,
      true,
      "custom",
      "user-avatars/student-user/avatar.webp"
    );

    await expect(getCurrentSession()).resolves.toMatchObject({
      user: {
        image: expect.stringMatching(PRIVATE_AVATAR_URL_PATTERN),
      },
    });
  });

  it("uses a new opaque URL revision after replacing the active avatar object", async () => {
    const firstObjectKey = "user-avatars/student-user/first.webp";
    const secondObjectKey = "user-avatars/student-user/second.webp";
    setDatabaseIdentity("student", null, null, true, "custom", firstObjectKey);
    const firstSession = await getCurrentSession();

    setDatabaseIdentity("student", null, null, true, "custom", secondObjectKey);
    const secondSession = await getCurrentSession();

    expect(firstSession?.user.image).not.toBe(secondSession?.user.image);
    expect(firstSession?.user.image).not.toContain(firstObjectKey);
    expect(secondSession?.user.image).not.toContain(secondObjectKey);
  });

  it("redirects a blocked Student away from account settings", async () => {
    setDatabaseIdentity("student", null, new Date());

    await expect(requireAccountSession()).rejects.toThrow("redirect:/entrar");
    expect(dependencies.redirect).toHaveBeenCalledWith("/entrar");
  });

  it("redirects a blocked Student from regular internal routes too", async () => {
    setDatabaseIdentity("student", null, new Date());

    await expect(requireSession()).rejects.toThrow("redirect:/entrar");
    expect(dependencies.redirect).toHaveBeenCalledWith("/entrar");
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
