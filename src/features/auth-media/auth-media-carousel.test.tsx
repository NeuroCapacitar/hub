/**
 * @vitest-environment jsdom
 */

import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthMediaCarousel } from "./auth-media-carousel";

const carouselState = vi.hoisted(() => {
  let selectedIndex = 0;
  const listeners = new Map<string, Set<() => void>>();
  const api = {
    off: vi.fn((event: string, callback: () => void) => {
      listeners.get(event)?.delete(callback);
    }),
    on: vi.fn((event: string, callback: () => void) => {
      const eventListeners = listeners.get(event) ?? new Set<() => void>();
      eventListeners.add(callback);
      listeners.set(event, eventListeners);
    }),
    reInit: vi.fn(),
    scrollTo: vi.fn((index: number) => {
      selectedIndex = index;
      for (const callback of listeners.get("select") ?? []) {
        callback();
      }
    }),
    selectedScrollSnap: vi.fn(() => selectedIndex),
  };

  return {
    api,
    reset: () => {
      selectedIndex = 0;
      listeners.clear();
      vi.clearAllMocks();
    },
  };
});

const autoplayMock = vi.hoisted(() =>
  vi.fn((options: Record<string, unknown>) => ({ options }))
);

vi.mock("embla-carousel-autoplay", () => ({ default: autoplayMock }));
vi.mock("@/components/ui/carousel", () => ({
  Carousel: ({
    children,
    opts,
    setApi,
    ...props
  }: {
    children: React.ReactNode;
    opts?: { watchDrag?: boolean };
    setApi?: (api: typeof carouselState.api) => void;
  } & React.HTMLAttributes<HTMLDivElement>) => {
    useEffect(() => {
      setApi?.(carouselState.api);
    }, [setApi]);
    return (
      <div
        data-slot="carousel"
        data-watch-drag={String(opts?.watchDrag ?? false)}
        {...props}
      >
        {children}
      </div>
    );
  },
  CarouselContent: ({
    children,
    className,
  }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={className} data-slot="carousel-content">
      {children}
    </div>
  ),
  CarouselItem: ({
    children,
    className,
  }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={className} data-slot="carousel-item">
      {children}
    </div>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    onError,
    sizes,
    src,
  }: {
    onError?: () => void;
    sizes?: string;
    src: string;
  }) => (
    <button
      aria-label="Imagem de teste"
      data-auth-media-image
      data-image-sizes={sizes}
      data-src={src}
      onClick={onError}
      type="button"
    />
  ),
}));

const slides = [
  {
    blurDataUrl: "",
    id: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
    imageUrl: "https://media.example.test/auth-media/one.webp",
    sortOrder: 1,
  },
  {
    blurDataUrl: "",
    id: "44feef7e-1b03-46c4-8119-ad22e5e57826",
    imageUrl: "https://media.example.test/auth-media/two.webp",
    sortOrder: 2,
  },
];

const renderCarousel = ({
  desktop,
  items = slides,
}: {
  desktop: boolean;
  items?: typeof slides;
}): { container: HTMLDivElement; root: ReturnType<typeof createRoot> } => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      addEventListener: vi.fn(),
      matches: query.includes("min-width") && desktop,
      media: query,
      removeEventListener: vi.fn(),
    }))
  );

  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<AuthMediaCarousel slides={items} />));
  return { container, root };
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  carouselState.reset();
  document.body.replaceChildren();
});

describe("AuthMediaCarousel", () => {
  it("does not render or request media below the desktop breakpoint", () => {
    const { container, root } = renderCarousel({ desktop: false });

    expect(container.querySelector("[data-auth-media-image]")).toBeNull();
    expect(
      container.querySelector('button[aria-label="Mostrar imagem 1"]')
    ).toBeNull();
    act(() => root.unmount());
  });

  it("renders the fallback when no active slides exist", () => {
    const { container, root } = renderCarousel({
      desktop: true,
      items: [],
    });

    expect(
      container
        .querySelector("[data-auth-media-image]")
        ?.getAttribute("data-src")
    ).toBe("/brand/login-capa.webp");
    expect(
      container
        .querySelector("[data-auth-media-image]")
        ?.getAttribute("data-image-sizes")
    ).toBe("(min-width: 1024px) 56vw, 100vw");
    expect(
      container.querySelector('button[aria-label="Mostrar imagem 1"]')
    ).toBeNull();
    act(() => root.unmount());
  });

  it("supports manual navigation with the horizontal carousel", () => {
    const { container, root } = renderCarousel({ desktop: true });

    expect(
      container
        .querySelector("[data-auth-media-image]")
        ?.getAttribute("data-src")
    ).toBe(slides[0]?.imageUrl);
    expect(
      container
        .querySelector('button[aria-current="true"] span')
        ?.classList.contains("w-4")
    ).toBe(true);
    act(() =>
      container
        .querySelector('button[aria-label="Mostrar imagem 2"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
    expect(
      container.querySelector(
        'button[aria-label="Mostrar imagem 2"][aria-current="true"]'
      )
    ).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Imagem anterior"]')
    ).toBeNull();
    expect(carouselState.api.scrollTo).toHaveBeenCalledWith(1);
    act(() => root.unmount());
  });

  it("configures six-second autoplay to pause only while hovered", () => {
    const { container, root } = renderCarousel({ desktop: true });

    expect(
      container
        .querySelector('[data-slot="carousel"]')
        ?.getAttribute("data-watch-drag")
    ).toBe("true");
    expect(autoplayMock).toHaveBeenCalledWith({
      delay: 6000,
      stopOnFocusIn: false,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    });
    expect(
      container.querySelector('button[aria-label="Mostrar imagem 2"]')
    ).not.toBeNull();
    act(() => root.unmount());
  });

  it("falls back when every active image fails", () => {
    const { container, root } = renderCarousel({ desktop: true });
    const firstImage = container.querySelector<HTMLButtonElement>(
      '[data-auth-media-image][data-src="https://media.example.test/auth-media/one.webp"]'
    );
    if (!firstImage) {
      throw new Error("Imagem de teste não encontrada.");
    }

    act(() => firstImage.click());
    const secondImage = container.querySelector<HTMLButtonElement>(
      '[data-auth-media-image][data-src="https://media.example.test/auth-media/two.webp"]'
    );
    if (!secondImage) {
      throw new Error("Segunda imagem de teste não encontrada.");
    }

    act(() => secondImage.click());
    expect(
      container
        .querySelector("[data-auth-media-image]")
        ?.getAttribute("data-src")
    ).toBe("/brand/login-capa.webp");
    act(() => root.unmount());
  });
});
