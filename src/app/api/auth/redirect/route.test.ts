import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  recordStudentLastAccess: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({
  getCurrentSession: dependencies.getCurrentSession,
  recordStudentLastAccess: dependencies.recordStudentLastAccess,
}));

import { GET } from "./route";

const createRequest = (returnTo?: string): Request => {
  const url = new URL("https://hub.example.test/api/auth/redirect");
  if (returnTo !== undefined) {
    url.searchParams.set("returnTo", returnTo);
  }
  return new Request(url);
};

describe("GET /api/auth/redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes an authenticated admin session to the admin surface", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role: "admin",
    });

    await expect(
      (await GET(createRequest("/comprar/curso-gratis"))).json()
    ).resolves.toEqual({
      redirectTo: "/admin",
    });
  });

  it("routes an authenticated support session to the admin surface", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role: "support",
      supportPermissionViews: [
        "viewAdminPanel",
        "viewLearningAnalytics",
        "viewCourses",
        "viewStudents",
        "viewFinancials",
        "viewOperations",
        "viewAudit",
        "viewSettings",
      ],
    });

    await expect(
      (await GET(createRequest("/comprar/curso-gratis"))).json()
    ).resolves.toEqual({
      redirectTo: "/admin",
    });
  });

  it("refuses to redirect a blocked student", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: new Date("2026-09-01T12:00:00.000Z"),
      role: "student",
    });

    const response = await GET(createRequest("/comprar/curso-gratis"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "blocked" });
  });

  it("records the last access before redirecting an authenticated student", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role: "student",
      user: { id: "student-1" },
    });

    const response = await GET(createRequest("/comprar/curso-gratis"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      redirectTo: "/comprar/curso-gratis",
    });
    expect(dependencies.recordStudentLastAccess).toHaveBeenCalledWith(
      "student-1"
    );
  });

  it("falls back to the student surface for an invalid return path", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role: "student",
      user: { id: "student-1" },
    });

    const response = await GET(createRequest("https://other.example/escape"));

    await expect(response.json()).resolves.toEqual({ redirectTo: "/app" });
  });

  it("falls back to the student surface when returnTo is repeated", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role: "student",
      user: { id: "student-1" },
    });
    const url = new URL("https://hub.example.test/api/auth/redirect");
    url.searchParams.append("returnTo", "/comprar/curso-gratis");
    url.searchParams.append("returnTo", "/comprar/outro-curso");

    const response = await GET(new Request(url));

    await expect(response.json()).resolves.toEqual({ redirectTo: "/app" });
  });

  it("keeps unauthenticated users on the login surface", async () => {
    dependencies.getCurrentSession.mockResolvedValue(null);

    const response = await GET(createRequest("/comprar/curso-gratis"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ redirectTo: "/entrar" });
  });
});
