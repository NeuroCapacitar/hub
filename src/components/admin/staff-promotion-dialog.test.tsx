import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/admin/staff-actions", () => ({
  changeStaffAccessAction: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    loading: vi.fn(),
    success: vi.fn(),
  },
}));

import { StaffPromotionDialog } from "./staff-promotion-dialog";

describe("StaffPromotionDialog", () => {
  it("exposes one guarded entry point instead of an inline promotion form", () => {
    const markup = renderToStaticMarkup(<StaffPromotionDialog />);

    expect(markup).toContain("Adicionar à equipe");
    expect(markup).not.toContain("Buscar Aluno");
    expect(markup).not.toContain("Promover para equipe");
  });
});
