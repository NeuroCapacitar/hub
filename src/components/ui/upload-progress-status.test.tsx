/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadProgressStatus } from "./upload-progress-status";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

describe("UploadProgressStatus", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("presents per-file recovery actions with accessible names", () => {
    const onRetry = vi.fn();
    const onDiscard = vi.fn();

    act(() =>
      root.render(
        <UploadProgressStatus
          errorMessage="Falha temporária. Tente novamente."
          fileName="capa.webp"
          onDiscard={onDiscard}
          onRetry={onRetry}
          phase="uploading"
        />
      )
    );

    const retryButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Tentar novamente capa.webp"]'
    );
    const discardButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Descartar envio de capa.webp"]'
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Falha temporária. Tente novamente."
    );
    expect(retryButton).not.toBeNull();
    expect(discardButton).not.toBeNull();

    act(() => {
      retryButton?.click();
      discardButton?.click();
    });

    expect(onRetry).toHaveBeenCalledOnce();
    expect(onDiscard).toHaveBeenCalledOnce();
  });
});
