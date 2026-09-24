/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  error: vi.fn(),
  loading: vi.fn(),
  success: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: dependencies }));

import { AdminMutationForm } from "./admin-mutation-form";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

describe("AdminMutationForm", () => {
  let container: HTMLDivElement;
  let root: Root;
  let previousActEnvironment: boolean | undefined;

  beforeEach(() => {
    previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    dependencies.loading.mockReturnValue("mutation-toast");
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
    if (previousActEnvironment === undefined) {
      Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    } else {
      globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    }
  });

  it("does not render a DialogClose when used by a Sheet", () => {
    const markup = renderToStaticMarkup(
      <AdminMutationForm
        action={vi.fn().mockResolvedValue(undefined)}
        closeOnSuccess={false}
      >
        <button type="submit">Salvar</button>
      </AdminMutationForm>
    );

    expect(markup).toContain("Salvar");
    expect(markup).not.toContain("Fechar");
  });

  it("uses flow-specific pending and success feedback when provided", async () => {
    act(() =>
      root.render(
        <AdminMutationForm
          action={vi.fn().mockResolvedValue(undefined)}
          pendingMessage="Registrando pedido…"
          successMessage="Pedido de suporte registrado."
        >
          <button type="submit">Enviar</button>
        </AdminMutationForm>
      )
    );

    const form = container.querySelector("form");
    expect(form).not.toBeNull();

    await act(async () => {
      form?.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(dependencies.loading).toHaveBeenCalledWith("Registrando pedido…");
    expect(dependencies.success).toHaveBeenCalledWith(
      "Pedido de suporte registrado.",
      { id: "mutation-toast" }
    );
  });
});
