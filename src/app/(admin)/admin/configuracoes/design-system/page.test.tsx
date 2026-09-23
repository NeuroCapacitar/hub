import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dependencies = vi.hoisted(() => ({
  requirePermission: vi.fn(),
}));

vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));
vi.mock("@/components/design-system-preview", () => ({
  DesignSystemPreview: () => <div>Componentes do sistema visual</div>,
}));

import DesignSystemPage from "./page";

describe("DesignSystemPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requirePermission.mockResolvedValue({ role: "admin" });
  });

  it("requires settings access and explains the visual reference", async () => {
    const markup = renderToStaticMarkup(await DesignSystemPage());

    expect(dependencies.requirePermission).toHaveBeenCalledWith("viewSettings");
    expect(markup).toContain("Sistema visual");
    expect(markup).toContain(
      "Referência dos componentes, estados e padrões visuais usados no Hub."
    );
    expect(markup).toContain("Componentes do sistema visual");
  });
});
