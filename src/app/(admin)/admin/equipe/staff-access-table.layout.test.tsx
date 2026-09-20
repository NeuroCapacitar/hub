/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StaffAccessTable } from "./staff-access-table";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/features/admin/staff-actions", () => ({
  changeStaffAccessAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
  },
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("staff access dialog layout", () => {
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
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("keeps the permissions body scrollable inside the mutation form", async () => {
    act(() => {
      root.render(
        <StaffAccessTable
          actorUserId="admin-1"
          members={[
            {
              email: "support@example.test",
              lastAccessAt: null,
              name: "Suporte",
              role: "support",
              supportPermissionGrants: [],
              supportPermissionViews: [],
              userId: "support-1",
            },
          ]}
        />
      );
    });

    const trigger = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Alterar acesso"
    );

    await act(async () => {
      trigger?.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, button: 0 })
      );
      trigger?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const form = document.querySelector("form");
    const dialogBody = document.querySelector('[data-slot="dialog-body"]');

    expect(form?.className).toContain("flex");
    expect(form?.className).toContain("min-h-0");
    expect(form?.className).toContain("flex-1");
    expect(dialogBody?.className).toContain("min-h-0");
    expect(dialogBody?.className).toContain("flex-1");
    expect(dialogBody?.className).toContain("overscroll-contain");
    expect(document.body.textContent).toContain("Permissões configuráveis");
    expect(document.body.textContent).toContain(
      "Criar Cursos no catálogo administrativo."
    );
    expect(document.querySelector('input[name="role"]')).not.toBeNull();
    expect(
      document.querySelector(
        'button[aria-label="Ajuda: Como funcionam as permissões"]'
      )
    ).not.toBeNull();
    expect(document.body.textContent).not.toContain("Resumo da configuração");
    expect(document.body.textContent).not.toContain(
      "Ações específicas que podem ser delegadas."
    );
    expect(document.body.textContent).toContain("Criar Cursos");

    for (const groupLabel of ["Financeiro", "Auditoria"]) {
      const groupTrigger = Array.from(document.querySelectorAll("button")).find(
        (button) => button.textContent?.includes(groupLabel)
      );

      act(() => {
        groupTrigger?.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true })
        );
      });
    }

    expect(document.body.textContent).toContain("Ver pedidos");
    expect(document.body.textContent).toContain("Ver Auditoria");
    expect(document.body.textContent).not.toContain("Ver painel");
    expect(document.body.textContent).not.toContain("Ver aprendizagem");
    expect(document.body.textContent).not.toContain("Ver Cursos");
    expect(document.body.textContent).not.toContain("Ver Alunos");
    expect(document.body.textContent).not.toContain("Ver Operação");
    expect(document.body.textContent).not.toContain("Ver Configurações");
  });
});
