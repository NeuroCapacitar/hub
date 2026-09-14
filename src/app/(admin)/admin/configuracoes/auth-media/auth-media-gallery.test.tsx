/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
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
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
  arrayMove: vi.fn(),
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
});
