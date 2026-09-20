/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutAccessWaiter } from "./checkout-access-waiter";

const fetchMock = vi.fn();

vi.mock("@/components/support-request-dialog", () => ({
  SupportRequestDialog: () => <button type="button">Falar com suporte</button>,
}));

const response = (body: unknown): Response =>
  ({
    json: vi.fn().mockResolvedValue(body),
    ok: true,
  }) as unknown as Response;

const context = {
  coverBlurDataUrl: null,
  thumbnailUrl: null,
  title: "Curso one",
};

describe("CheckoutAccessWaiter", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("keeps the course context visible while checking access", async () => {
    fetchMock.mockResolvedValue(response({ canAccess: false }));

    act(() => {
      root.render(
        <CheckoutAccessWaiter courseContext={context} courseId="course-1" />
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Curso one");
    expect(container.textContent).toContain(
      "Ainda estamos confirmando seu acesso."
    );
  });

  it("communicates timeout without suggesting a new purchase", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(response({ canAccess: false }));

    act(() => {
      root.render(
        <CheckoutAccessWaiter courseContext={context} courseId="course-1" />
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    for (let attempt = 0; attempt < 30; attempt += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });
    }

    expect(container.textContent).toContain(
      "Ainda não conseguimos confirmar seu acesso automaticamente."
    );
    expect(container.textContent).toContain("Verificar novamente");
    expect(container.textContent).not.toContain("Comprar");

    const verifyAgainButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Verificar novamente"
    );
    expect(verifyAgainButton).toBeDefined();

    const callsBeforeRestart = fetchMock.mock.calls.length;
    act(() => {
      verifyAgainButton?.click();
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeRestart + 1);
  });
});
