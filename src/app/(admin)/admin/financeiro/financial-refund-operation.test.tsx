/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  confirmRefundPasswordAction: vi.fn(),
  listAccounts: vi.fn(),
  requestFullRefundAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/payments/actions", () => dependencies);
vi.mock("@/lib/auth-client", () => ({
  authClient: { listAccounts: dependencies.listAccounts },
}));

import { RefundOperation } from "./financial-refund-operation";

describe("RefundOperation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    dependencies.confirmRefundPasswordAction.mockReset();
    dependencies.listAccounts.mockReset();
    dependencies.requestFullRefundAction.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("describes the refund as a two-step request and protects identity reviews", async () => {
    dependencies.listAccounts.mockResolvedValue({
      data: [
        {
          accountId: "admin-1",
          createdAt: new Date("2026-10-01T12:00:00.000Z"),
          id: "credential-account",
          providerId: "credential",
          scopes: [],
          updatedAt: new Date("2026-10-01T12:00:00.000Z"),
          userId: "admin-1",
        },
      ],
      error: null,
    });

    act(() => {
      root.render(<RefundOperation identityReview orderId="order-1" />);
    });

    const details = container.querySelector("details");
    if (!details) {
      throw new Error("Refund operation disclosure was not rendered.");
    }

    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Etapa 1 de 2: confirmar a senha");
    expect(container.textContent).toContain(
      "Nenhum acesso é liberado enquanto a revisão de identidade estiver pendente."
    );
    expect(container.textContent).not.toContain("O acesso permanece ativo");
    expect(
      container.querySelector('form[aria-labelledby="refund-step-one-order-1"]')
    ).not.toBeNull();
  });

  it("keeps the password form hidden until the credential check finishes", async () => {
    dependencies.listAccounts.mockReturnValue(new Promise(() => undefined));

    act(() => {
      root.render(<RefundOperation orderId="order-1" />);
    });

    const details = container.querySelector("details");
    if (!details) {
      throw new Error("Refund operation disclosure was not rendered.");
    }

    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Verificando o método de acesso…");
    expect(container.querySelector('input[name="password"]')).toBeNull();
  });

  it("announces and focuses the order confirmation step after password confirmation", async () => {
    dependencies.confirmRefundPasswordAction.mockResolvedValue({
      confirmationToken: "confirmation-token",
    });
    dependencies.listAccounts.mockResolvedValue({
      data: [
        {
          accountId: "admin-1",
          createdAt: new Date("2026-10-01T12:00:00.000Z"),
          id: "credential-account",
          providerId: "credential",
          scopes: [],
          updatedAt: new Date("2026-10-01T12:00:00.000Z"),
          userId: "admin-1",
        },
      ],
      error: null,
    });

    act(() => {
      root.render(<RefundOperation orderId="order-1" />);
    });

    const details = container.querySelector("details");
    if (!details) {
      throw new Error("Refund operation disclosure was not rendered.");
    }

    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle", { bubbles: true }));
      await Promise.resolve();
    });

    const form = container.querySelector("form");
    const passwordInput = container.querySelector<HTMLInputElement>(
      "input[name='password']"
    );
    expect(form).not.toBeNull();
    expect(passwordInput).not.toBeNull();

    if (!(form && passwordInput)) {
      throw new Error("Refund password form was not rendered.");
    }

    passwordInput.value = "current-password";
    await act(async () => {
      form.dispatchEvent(
        new SubmitEvent("submit", { bubbles: true, cancelable: true })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(dependencies.confirmRefundPasswordAction).toHaveBeenCalledOnce();
    expect(container.textContent).toContain(
      "Senha confirmada. A etapa 2 de 2 está pronta para preenchimento."
    );
    expect(document.activeElement?.id).toBe("refund-order-order-1");
    expect(container.textContent).toContain(
      "Confirmar solicitação de reembolso"
    );
  });

  it("offers the approved password setup flow to an invited Google-only user", async () => {
    dependencies.listAccounts.mockResolvedValue({
      data: [
        {
          accountId: "google-subject",
          createdAt: new Date("2026-10-01T12:00:00.000Z"),
          id: "google-account",
          providerId: "google",
          scopes: [],
          updatedAt: new Date("2026-10-01T12:00:00.000Z"),
          userId: "admin-1",
        },
      ],
      error: null,
    });

    act(() => {
      root.render(<RefundOperation orderId="order-1" />);
    });
    const details = container.querySelector("details");
    if (!details) {
      throw new Error("Refund operation disclosure was not rendered.");
    }

    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle", { bubbles: true }));
      await Promise.resolve();
    });

    expect(dependencies.listAccounts).toHaveBeenCalledOnce();
    expect(container.querySelector('input[name="password"]')).toBeNull();
    expect(container.textContent).toContain(
      "Sua conta ainda não tem uma senha local."
    );
    const setupLink = container.querySelector<HTMLAnchorElement>(
      'a[href="/recuperar-senha"]'
    );
    expect(setupLink?.textContent).toContain("Definir senha por e-mail");
    expect(setupLink?.target).toBe("_blank");
    expect(setupLink?.rel).toContain("noopener");
  });

  it("shows password confirmation only when a credential account exists", async () => {
    dependencies.listAccounts.mockResolvedValue({
      data: [
        {
          accountId: "admin-1",
          createdAt: new Date("2026-10-01T12:00:00.000Z"),
          id: "credential-account",
          providerId: "credential",
          scopes: [],
          updatedAt: new Date("2026-10-01T12:00:00.000Z"),
          userId: "admin-1",
        },
      ],
      error: null,
    });

    act(() => {
      root.render(<RefundOperation orderId="order-1" />);
    });
    const details = container.querySelector("details");
    if (!details) {
      throw new Error("Refund operation disclosure was not rendered.");
    }

    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.querySelector('input[name="password"]')).not.toBeNull();
    expect(container.textContent).not.toContain(
      "Sua conta ainda não tem uma senha local."
    );
  });

  it("lets the user return from password setup and recheck before continuing", async () => {
    dependencies.listAccounts
      .mockResolvedValueOnce({
        data: [
          {
            accountId: "google-subject",
            createdAt: new Date("2026-10-01T12:00:00.000Z"),
            id: "google-account",
            providerId: "google",
            scopes: [],
            updatedAt: new Date("2026-10-01T12:00:00.000Z"),
            userId: "admin-1",
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            accountId: "admin-1",
            createdAt: new Date("2026-10-01T12:00:00.000Z"),
            id: "credential-account",
            providerId: "credential",
            scopes: [],
            updatedAt: new Date("2026-10-01T12:00:00.000Z"),
            userId: "admin-1",
          },
        ],
        error: null,
      });

    act(() => {
      root.render(<RefundOperation orderId="order-1" />);
    });
    const details = container.querySelector("details");
    if (!details) {
      throw new Error("Refund operation disclosure was not rendered.");
    }

    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle", { bubbles: true }));
      await Promise.resolve();
    });

    const checkButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("Já defini a senha")
    );
    expect(checkButton).toBeDefined();

    await act(async () => {
      checkButton?.click();
      await Promise.resolve();
    });

    expect(dependencies.listAccounts).toHaveBeenCalledTimes(2);
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
  });

  it("keeps the refund step safe and offers retry when account methods cannot load", async () => {
    dependencies.listAccounts.mockResolvedValue({
      data: null,
      error: { message: "unavailable" },
    });

    act(() => {
      root.render(<RefundOperation orderId="order-1" />);
    });
    const details = container.querySelector("details");
    if (!details) {
      throw new Error("Refund operation disclosure was not rendered.");
    }

    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.querySelector('input[name="password"]')).toBeNull();
    expect(container.textContent).toContain(
      "Não foi possível verificar o método de acesso."
    );
    expect(container.textContent).toContain("Tentar novamente");
  });
});
