import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getStaffPromotionCandidates: vi.fn(),
}));

vi.mock("@/features/admin/staff-server", () => ({
  getStaffPromotionCandidates: dependencies.getStaffPromotionCandidates,
}));

import { GET } from "./route";

describe("GET /api/admin/staff/promotion-candidates", () => {
  it("returns fresh candidate results for the current search", async () => {
    dependencies.getStaffPromotionCandidates.mockResolvedValue({
      candidates: [
        {
          email: "student@example.test",
          name: "Aluno Teste",
          userId: "student-1",
        },
      ],
      hasMore: false,
      search: "student",
    });

    const response = await GET(
      new Request(
        "https://app.example.test/api/admin/staff/promotion-candidates?q=student"
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(dependencies.getStaffPromotionCandidates).toHaveBeenCalledWith(
      "student"
    );
    await expect(response.json()).resolves.toEqual({
      candidates: [
        {
          email: "student@example.test",
          name: "Aluno Teste",
          userId: "student-1",
        },
      ],
      hasMore: false,
      search: "student",
    });
  });

  it("passes an empty query through so the server remains the permission boundary", async () => {
    dependencies.getStaffPromotionCandidates.mockResolvedValue({
      candidates: [],
      hasMore: false,
      search: "",
    });

    await GET(
      new Request(
        "https://app.example.test/api/admin/staff/promotion-candidates"
      )
    );

    expect(dependencies.getStaffPromotionCandidates).toHaveBeenCalledWith("");
  });
});
