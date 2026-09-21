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
}));

vi.mock("next/navigation", () => ({
  useRouter: () => dependencies.router,
}));
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
  },
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
  saveBannerAction: vi.fn(),
}));
vi.mock("@/features/storage/staged-image-upload-client", () => ({
  uploadStagedAdminImage: vi.fn(),
}));
vi.mock("./banner-edit-modal", () => ({ BannerEditModal: () => null }));
vi.mock("./sortable-banner-item", () => ({
  SortableBannerItem: () => <div data-sortable-banner />,
}));
vi.mock("@/features/banners/banner-crop-dialog", () => ({
  BannerCropDialog: () => null,
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
    dependencies.reorderBannersAction.mockResolvedValue(undefined);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
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
});
