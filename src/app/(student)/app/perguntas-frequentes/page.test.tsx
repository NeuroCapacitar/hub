import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  connection: vi.fn(),
  getPublishedFaqItems: vi.fn(),
  permanentRedirect: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  permanentRedirect: dependencies.permanentRedirect,
}));
vi.mock("next/server", () => ({
  connection: dependencies.connection,
}));
vi.mock("@/features/courses/preview", () => ({
  canMutateStudentExperience: () => true,
}));
vi.mock("@/features/courses/server", () => ({
  getPublishedFaqItems: dependencies.getPublishedFaqItems,
}));
vi.mock("@/lib/session", () => ({
  requireSession: dependencies.requireSession,
}));
vi.mock("@/components/support-request-dialog", () => ({
  SupportRequestDialog: ({ triggerLabel }: { triggerLabel: string }) => (
    <button type="button">{triggerLabel}</button>
  ),
}));

import StudentFaqLegacyRoute from "./page";

describe("StudentFaqLegacyRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.connection.mockResolvedValue(undefined);
    dependencies.getPublishedFaqItems.mockResolvedValue([]);
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
  });

  it("permanently redirects the retired FAQ route to Ajuda", async () => {
    await StudentFaqLegacyRoute();

    expect(dependencies.connection).toHaveBeenCalledOnce();
    expect(dependencies.permanentRedirect).toHaveBeenCalledWith("/app/ajuda");
  });
});
