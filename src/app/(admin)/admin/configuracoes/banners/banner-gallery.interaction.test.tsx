/**
 * @vitest-environment jsdom
 */

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  dndHandlers: {
    onDragEnd: undefined as ((event: unknown) => void) | undefined,
  },
  reorderBannersAction: vi.fn(),
  router: { refresh: vi.fn() },
  saveBannerAction: vi.fn(),
  uploadStagedAdminImage: vi.fn(),
  toast: {
    error: vi.fn(),
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => dependencies.router,
}));
vi.mock("sonner", () => ({
  toast: dependencies.toast,
}));
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: ReactNode;
    onDragEnd: (event: unknown) => void;
  }) => {
    dependencies.dndHandlers.onDragEnd = onDragEnd;
    return <>{children}</>;
  },
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));
vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  arrayMove: vi.fn((items: unknown[], from: number, to: number) => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    if (item !== undefined) {
      next.splice(to, 0, item);
    }
    return next;
  }),
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
}));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));
vi.mock("@/features/admin/actions", () => ({
  deleteBannerAction: vi.fn(),
  reorderBannersAction: dependencies.reorderBannersAction,
  saveBannerAction: dependencies.saveBannerAction,
}));
vi.mock("@/features/storage/staged-image-upload-client", () => ({
  uploadStagedAdminImage: dependencies.uploadStagedAdminImage,
}));
vi.mock("./banner-edit-modal", () => ({ BannerEditModal: () => null }));
vi.mock("./sortable-banner-item", () => ({
  SortableBannerItem: () => <div data-sortable-banner />,
}));
vi.mock("@/features/banners/banner-crop-dialog", () => ({
  BannerCropDialog: ({
    file,
    onComplete,
  }: {
    file: File | null;
    onComplete: (file: File) => void;
  }) =>
    file ? (
      <button
        onClick={() =>
          onComplete(
            new File(["cropped"], "cropped.webp", { type: "image/webp" })
          )
        }
        type="button"
      >
        Confirmar recorte
      </button>
    ) : null,
}));

import { BannerGallery } from "./banner-gallery";

const createBanner = (id: string, sortOrder: number) => ({
  blurDataUrl: null,
  buttonText: null,
  id,
  imageUrl: `/api/banners/${id}/image`,
  isActive: true,
  linkUrl: null,
  sortOrder,
});

describe("BannerGallery interactions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    dependencies.reorderBannersAction.mockResolvedValue(undefined);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("persists a reordered banner list", async () => {
    act(() => {
      root.render(
        <BannerGallery
          initialBanners={[
            createBanner("banner-1", 1),
            createBanner("banner-2", 2),
          ]}
        />
      );
    });

    act(() => {
      dependencies.dndHandlers.onDragEnd?.({
        active: { id: "banner-1" },
        over: { id: "banner-2" },
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(dependencies.reorderBannersAction).toHaveBeenCalledWith([
      "banner-2",
      "banner-1",
    ]);
  });

  it("opens the banner file picker from the visible button", () => {
    act(() => root.render(<BannerGallery initialBanners={[]} />));
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    const addTrigger = [...container.querySelectorAll("label")].find((label) =>
      label.textContent?.includes("Adicionar banner")
    );
    if (!(input && addTrigger)) {
      throw new Error("Controle para adicionar banner não encontrado.");
    }
    expect(addTrigger.contains(input)).toBe(true);
    expect(addTrigger.className).toContain("focus-within");
    const clickInput = vi.fn();
    input.addEventListener("click", clickInput);

    act(() => addTrigger.click());

    expect(clickInput).toHaveBeenCalledOnce();
  });

  it("reserves banner capacity while an upload is in progress", async () => {
    dependencies.uploadStagedAdminImage.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true }
          );
        })
    );
    act(() =>
      root.render(
        <BannerGallery
          initialBanners={Array.from({ length: 4 }, (_, index) =>
            createBanner(`banner-${index + 1}`, index + 1)
          )}
        />
      )
    );
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error("Seletor de banner não encontrado.");
    }
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["source"], "source.png", { type: "image/png" })],
    });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));
    const cropButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Confirmar recorte"
    );
    await act(async () => {
      cropButton?.click();
      await Promise.resolve();
    });

    expect(
      [...container.querySelectorAll("label")].some((label) =>
        label.textContent?.includes("Adicionar banner")
      )
    ).toBe(false);
  });

  it("keeps banner upload errors inline without duplicating them in a toast", async () => {
    dependencies.uploadStagedAdminImage.mockRejectedValueOnce(
      new Error("Falha de rede")
    );
    act(() => root.render(<BannerGallery initialBanners={[]} />));
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error("Seletor de banner não encontrado.");
    }
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["source"], "source.png", { type: "image/png" })],
    });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));
    const cropButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Confirmar recorte"
    );

    await act(async () => {
      cropButton?.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("cropped.webp");
    expect(container.textContent).toContain("Falha de rede");
    expect(
      container.querySelector('[aria-label="Tentar novamente cropped.webp"]')
    ).not.toBeNull();
    expect(dependencies.toast.error).not.toHaveBeenCalled();
  });

  it("retries a failed banner transfer using the selected file", async () => {
    dependencies.uploadStagedAdminImage
      .mockRejectedValueOnce(new Error("Falha de rede"))
      .mockResolvedValueOnce({ imageUpload: "staged" });
    dependencies.saveBannerAction.mockResolvedValueOnce({
      bannerId: "banner-retried",
    });
    act(() => root.render(<BannerGallery initialBanners={[]} />));
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error("Seletor de banner não encontrado.");
    }
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["source"], "source.png", { type: "image/png" })],
    });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));
    const cropButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Confirmar recorte"
    );
    await act(async () => {
      cropButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const retryButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Tentar novamente cropped.webp"]'
    );
    expect(retryButton).not.toBeNull();
    await act(async () => {
      retryButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(dependencies.uploadStagedAdminImage).toHaveBeenCalledTimes(2);
    const aggregateIds = dependencies.uploadStagedAdminImage.mock.calls.map(
      ([input]) => (input as { aggregateId: string }).aggregateId
    );
    expect(new Set(aggregateIds).size).toBe(1);
    expect(dependencies.saveBannerAction).toHaveBeenCalledOnce();
    expect(
      container.querySelector('[aria-label="Tentar novamente cropped.webp"]')
    ).toBeNull();
  });

  it("does not offer automatic retry after a save response with an unknown outcome", async () => {
    dependencies.uploadStagedAdminImage.mockResolvedValue({
      aggregateId: "banner-1",
      contentType: "image/webp",
      fileName: "cropped.webp",
      key: "uploads/admin-images/admin-1/dashboard-banner/banner-1/image.webp",
      purpose: "dashboard-banner",
      sizeBytes: 7,
    });
    dependencies.saveBannerAction.mockRejectedValueOnce(
      new Error("Resposta indisponível")
    );
    act(() => root.render(<BannerGallery initialBanners={[]} />));
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error("Seletor de banner não encontrado.");
    }
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["source"], "source.png", { type: "image/png" })],
    });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));
    const cropButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Confirmar recorte"
    );
    await act(async () => {
      cropButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain(
      "Não foi possível confirmar se o banner foi salvo"
    );
    expect(
      container.querySelector('[aria-label="Tentar novamente cropped.webp"]')
    ).toBeNull();
    expect(
      container.querySelector('[aria-label="Descartar envio de cropped.webp"]')
    ).not.toBeNull();
    expect(dependencies.toast.error).not.toHaveBeenCalled();
  });

  it("releases an optimistic preview URL when the saved banner arrives", async () => {
    const createObjectURL = vi.fn(() => "blob:banner-preview");
    const revokeObjectURL = vi.fn();
    const NativeURL = globalThis.URL;
    const MockURL = class extends NativeURL {};
    Object.assign(MockURL, { createObjectURL, revokeObjectURL });
    vi.stubGlobal("URL", MockURL);
    dependencies.uploadStagedAdminImage.mockResolvedValue({
      aggregateId: "banner-5",
      contentType: "image/webp",
      fileName: "cropped.webp",
      key: "uploads/admin-images/admin-1/dashboard-banner/banner-5/image.webp",
      purpose: "dashboard-banner",
      sizeBytes: 7,
    });
    dependencies.saveBannerAction.mockResolvedValueOnce({
      bannerId: "banner-5",
    });
    act(() => root.render(<BannerGallery initialBanners={[]} />));
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error("Seletor de banner não encontrado.");
    }
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["source"], "source.png", { type: "image/png" })],
    });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));
    const cropButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Confirmar recorte"
    );

    await act(async () => {
      cropButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createObjectURL).toHaveBeenCalledOnce();
    await act(async () => {
      root.render(
        <BannerGallery initialBanners={[createBanner("banner-5", 1)]} />
      );
      await Promise.resolve();
    });

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:banner-preview");
  });

  it("aborts a selected banner upload without invoking the save action", async () => {
    let uploadSignal: AbortSignal | undefined;
    dependencies.uploadStagedAdminImage.mockImplementation(
      ({ signal }: { signal: AbortSignal }) => {
        uploadSignal = signal;
        return new Promise((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true }
          );
        });
      }
    );
    act(() => root.render(<BannerGallery initialBanners={[]} />));
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error("Seletor de banner não encontrado.");
    }
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["source"], "source.png", { type: "image/png" })],
    });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));
    const cropButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Confirmar recorte"
    );
    await act(async () => {
      cropButton?.click();
      await Promise.resolve();
    });

    const cancelButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Cancelar"
    );
    expect(cancelButton).toBeDefined();
    expect(cancelButton?.getAttribute("aria-label")).toBe(
      "Cancelar envio de cropped.webp"
    );
    await act(async () => {
      cancelButton?.click();
      await Promise.resolve();
    });

    expect(uploadSignal?.aborted).toBe(true);
    expect(dependencies.saveBannerAction).not.toHaveBeenCalled();
  });
});
