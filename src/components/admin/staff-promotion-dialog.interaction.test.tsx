/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/admin/staff-actions", () => ({
  changeStaffAccessAction: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
  },
}));

import { StaffPromotionDialog } from "./staff-promotion-dialog";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("StaffPromotionDialog interaction", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserverStub {
        disconnect(): void {
          // Radix only needs no-op observation hooks in jsdom.
        }
        observe(): void {
          // Radix only needs no-op observation hooks in jsdom.
        }
        unobserve(): void {
          // Radix only needs no-op observation hooks in jsdom.
        }
      }
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("searches as the user types and keeps selection and configuration in the same modal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              email: "student@example.test",
              name: "Aluno Teste",
              userId: "student-1",
            },
          ],
          hasMore: false,
          search: "student",
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    act(() => {
      root.render(<StaffPromotionDialog />);
    });

    await act(async () => {
      Array.from(document.querySelectorAll("button"))
        .find((button) => button.textContent?.trim() === "Adicionar à equipe")
        ?.click();
      await Promise.resolve();
    });

    const input = document.querySelector(
      'input[aria-label="Buscar Aluno"]'
    ) as HTMLInputElement | null;
    expect(input).not.toBeNull();

    await act(async () => {
      if (input) {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value"
        )?.set?.call(input, "student");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/staff/promotion-candidates?q=student",
      expect.objectContaining({ cache: "no-store" })
    );
    expect(document.body.textContent).toContain("Aluno Teste");

    await act(async () => {
      Array.from(document.querySelectorAll("button"))
        .find((button) => button.textContent?.trim() === "Selecionar")
        ?.click();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("Conta selecionada");
    expect(document.body.textContent).toContain("Justificativa");
    expect(document.body.textContent).toContain("Revisar promoção");
    expect(
      document.querySelectorAll('[data-slot="dialog-content"]')
    ).toHaveLength(1);
  });
});
