/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  dndHandlers: {
    onDragEnd: undefined as ((event: unknown) => void) | undefined,
  },
  deleteAuthMediaAction: vi.fn(),
  reorderAuthMediaAction: vi.fn(),
  router: { refresh: vi.fn() },
  saveAuthMediaAction: vi.fn(),
  toast: {
    error: vi.fn(),
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
  },
  toggleAuthMediaActiveAction: vi.fn(),
  uploadStagedAdminImage: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => dependencies.router,
}));
vi.mock("sonner", () => ({ toast: dependencies.toast }));
vi.mock("@/features/auth-media/actions", () => ({
  deleteAuthMediaAction: dependencies.deleteAuthMediaAction,
  reorderAuthMediaAction: dependencies.reorderAuthMediaAction,
  saveAuthMediaAction: dependencies.saveAuthMediaAction,
  toggleAuthMediaActiveAction: dependencies.toggleAuthMediaActiveAction,
}));
vi.mock("@/features/storage/staged-image-upload-client", () => ({
  uploadStagedAdminImage: dependencies.uploadStagedAdminImage,
}));
vi.mock("./sortable-auth-media-item", () => ({
  SortableAuthMediaItem: () => <div data-sortable-auth-media />,
}));
vi.mock("@/features/auth-media/auth-media-crop-dialog", () => ({
  AuthMediaCropDialog: ({
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
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode;
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
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
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
vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => null,
}));
vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  buttonVariants: () => "mock-button",
}));
vi.mock("@/components/ui/resource-list", () => ({
  ResourceDropzoneEmpty: () => <div>empty</div>,
  ResourceItemSkeleton: () => <div>skeleton</div>,
  ResourceListBody: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ResourceListContainer: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  ResourceListHeader: ({
    actions,
    title,
  }: {
    actions?: React.ReactNode;
    title: string;
  }) => (
    <div>
      <span>{title}</span>
      {actions}
    </div>
  ),
}));

import { AuthMediaGallery } from "./auth-media-gallery";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const stagedReference = {
  aggregateId: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
  contentType: "image/webp",
  fileName: "cropped.webp",
  key: "uploads/admin-images/admin-1/auth-media-slide/c989d54d-d13f-46a1-89ed-2069d7c1c45b/auth-media/upload.webp",
  purpose: "auth-media" as const,
  sizeBytes: 1024,
};

const renderGallery = (
  initialSlides: Array<{
    blurDataUrl: string;
    id: string;
    imageUrl: string;
    isActive: boolean;
    sortOrder: number;
  }> = []
) => {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<AuthMediaGallery initialSlides={initialSlides} />));
  return { container, root };
};

describe("AuthMediaGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    dependencies.uploadStagedAdminImage.mockResolvedValue(stagedReference);
    dependencies.saveAuthMediaAction.mockResolvedValue({
      slideId: stagedReference.aggregateId,
    });
  });

  it("crops and uploads a selected image through the auth-media purpose", async () => {
    const { container, root } = renderGallery();
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error("Seletor de imagem não encontrado.");
    }
    const sourceFile = new File(["source"], "source.jpg", {
      type: "image/jpeg",
    });
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [sourceFile],
    });

    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));
    const cropButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Confirmar recorte"
    );
    if (!cropButton) {
      throw new Error("Confirmação de recorte não encontrada.");
    }
    await act(async () => {
      cropButton.click();
      await Promise.resolve();
    });

    expect(dependencies.uploadStagedAdminImage).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "auth-media" })
    );
    expect(dependencies.saveAuthMediaAction).toHaveBeenCalledWith(
      expect.any(FormData)
    );
    expect(dependencies.router.refresh).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it("opens the auth media file picker from the visible button", () => {
    const { container, root } = renderGallery();
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    const addTrigger = [...container.querySelectorAll("label")].find((label) =>
      label.textContent?.includes("Adicionar imagens")
    );
    if (!(input && addTrigger)) {
      throw new Error("Controle para adicionar imagens não encontrado.");
    }
    expect(addTrigger.contains(input)).toBe(true);
    expect(addTrigger.className).toContain("focus-within");
    const clickInput = vi.fn();
    input.addEventListener("click", clickInput);

    act(() => addTrigger.click());

    expect(clickInput).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it("keeps auth media upload errors inline with a retry action and no duplicate toast", async () => {
    dependencies.uploadStagedAdminImage.mockRejectedValueOnce(
      new Error("Falha de rede")
    );
    const { container, root } = renderGallery();
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error("Seletor de imagem não encontrado.");
    }
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["source"], "source.jpg", { type: "image/jpeg" })],
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

    expect(container.textContent).toContain("cropped.webp");
    expect(container.textContent).toContain("Falha de rede");
    expect(
      container.querySelector('[aria-label="Tentar novamente cropped.webp"]')
    ).not.toBeNull();
    expect(dependencies.toast.error).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("retries a failed auth media transfer using the selected crop", async () => {
    dependencies.uploadStagedAdminImage
      .mockRejectedValueOnce(new Error("Falha de rede"))
      .mockResolvedValueOnce(stagedReference);
    const { container, root } = renderGallery();
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error("Seletor de imagem não encontrado.");
    }
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["source"], "source.jpg", { type: "image/jpeg" })],
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
    expect(dependencies.saveAuthMediaAction).toHaveBeenCalledOnce();
    expect(
      container.querySelector('[aria-label="Tentar novamente cropped.webp"]')
    ).toBeNull();
    act(() => root.unmount());
  });

  it("does not offer automatic retry after an auth media save with an unknown outcome", async () => {
    dependencies.saveAuthMediaAction.mockRejectedValueOnce(
      new Error("Resposta indisponível")
    );
    const { container, root } = renderGallery();
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error("Seletor de imagem não encontrado.");
    }
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["source"], "source.jpg", { type: "image/jpeg" })],
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
      "Não foi possível confirmar se a imagem foi salva"
    );
    expect(
      container.querySelector('[aria-label="Tentar novamente cropped.webp"]')
    ).toBeNull();
    expect(
      container.querySelector('[aria-label="Descartar envio de cropped.webp"]')
    ).not.toBeNull();
    expect(dependencies.toast.error).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("cancels the active R2 request without saving the auth image", async () => {
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
    const { container, root } = renderGallery();
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error("Seletor de imagem não encontrado.");
    }
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["source"], "source.jpg", { type: "image/jpeg" })],
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
    await act(async () => {
      cancelButton?.click();
      await Promise.resolve();
    });

    expect(uploadSignal?.aborted).toBe(true);
    expect(dependencies.saveAuthMediaAction).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("queues multiple selected images and uploads each crop", async () => {
    const { container, root } = renderGallery();
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error("Seletor de imagens não encontrado.");
    }

    const files = [
      new File(["one"], "one.jpg", { type: "image/jpeg" }),
      new File(["two"], "two.jpg", { type: "image/jpeg" }),
    ];
    Object.defineProperty(input, "files", {
      configurable: true,
      value: files,
    });

    expect(input.multiple).toBe(true);
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));

    const firstCropButton = Array.from(
      container.querySelectorAll("button")
    ).find((button) => button.textContent === "Confirmar recorte");
    if (!firstCropButton) {
      throw new Error("Primeira confirmação de recorte não encontrada.");
    }
    await act(async () => {
      firstCropButton.click();
      await Promise.resolve();
    });

    const secondCropButton = Array.from(
      container.querySelectorAll("button")
    ).find((button) => button.textContent === "Confirmar recorte");
    if (!secondCropButton) {
      throw new Error("Segunda confirmação de recorte não encontrada.");
    }
    await act(async () => {
      secondCropButton.click();
      await Promise.resolve();
    });

    expect(dependencies.uploadStagedAdminImage).toHaveBeenCalledTimes(2);
    expect(dependencies.saveAuthMediaAction).toHaveBeenCalledTimes(2);
    act(() => root.unmount());
  });

  it("does not offer another upload after five slides", () => {
    const initialSlides = [
      {
        blurDataUrl: "blur",
        id: "c989d54d-d13f-46a1-89ed-2069d7c1c451",
        imageUrl: "/api/admin/auth-media/slide-1/image",
        isActive: true,
        sortOrder: 1,
      },
      {
        blurDataUrl: "blur",
        id: "c989d54d-d13f-46a1-89ed-2069d7c1c452",
        imageUrl: "/api/admin/auth-media/slide-2/image",
        isActive: true,
        sortOrder: 2,
      },
      {
        blurDataUrl: "blur",
        id: "c989d54d-d13f-46a1-89ed-2069d7c1c453",
        imageUrl: "/api/admin/auth-media/slide-3/image",
        isActive: true,
        sortOrder: 3,
      },
      {
        blurDataUrl: "blur",
        id: "c989d54d-d13f-46a1-89ed-2069d7c1c454",
        imageUrl: "/api/admin/auth-media/slide-4/image",
        isActive: true,
        sortOrder: 4,
      },
      {
        blurDataUrl: "blur",
        id: "c989d54d-d13f-46a1-89ed-2069d7c1c455",
        imageUrl: "/api/admin/auth-media/slide-5/image",
        isActive: true,
        sortOrder: 5,
      },
    ];
    const { container, root } = renderGallery(initialSlides);

    expect(container.querySelector('input[type="file"]')).toBeNull();
    act(() => root.unmount());
  });

  it("persists a reordered image list", async () => {
    const initialSlides = [
      {
        blurDataUrl: "blur",
        id: "slide-1",
        imageUrl: "/api/admin/auth-media/slide-1/image",
        isActive: true,
        sortOrder: 1,
      },
      {
        blurDataUrl: "blur",
        id: "slide-2",
        imageUrl: "/api/admin/auth-media/slide-2/image",
        isActive: true,
        sortOrder: 2,
      },
    ];
    const { root } = renderGallery(initialSlides);

    act(() => {
      dependencies.dndHandlers.onDragEnd?.({
        active: { id: "slide-1" },
        over: { id: "slide-2" },
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(dependencies.reorderAuthMediaAction).toHaveBeenCalledWith([
      "slide-2",
      "slide-1",
    ]);
    act(() => root.unmount());
  });
});
