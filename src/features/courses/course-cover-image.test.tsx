import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ className, src }: { className?: string; src: string }) => (
    <div className={className} data-image data-src={src} />
  ),
}));

import {
  CourseCoverImage,
  CourseCoverImageFallback,
} from "./course-cover-image";

describe("CourseCoverImage", () => {
  it("zooms the cover layers inside a stationary crop frame", () => {
    const zoomProps = {
      alt: "",
      blurDataUrl: "data:image/webp;base64,blur",
      sizes: "320px",
      src: "/cover.webp",
      zoomOnHover: true,
    } as unknown as ComponentProps<typeof CourseCoverImage>;
    const markup = renderToStaticMarkup(
      createElement(CourseCoverImage, zoomProps)
    );

    expect(markup).toContain(
      'class="pointer-events-none absolute inset-0 overflow-hidden"'
    );
    expect(markup).toContain("bg-center bg-cover");
    expect(markup).not.toContain("scale-105");
    expect(markup).toContain("transition-transform duration-300 ease-in-out");
    expect(markup).toContain("origin-center");
    expect(markup).toContain("group-hover:scale-[1.04]");
    expect(markup).toContain("group-hover:duration-400");
    expect(markup.split("group-hover:scale-[1.04]")).toHaveLength(3);
    expect(markup).toContain(
      'class="absolute inset-0 transition-opacity duration-200 opacity-0"'
    );
    expect(markup).toContain('class="object-cover');
    expect(markup).toContain('data-image="true" data-src="/cover.webp"');
  });

  it("retains blur overscan when the image has no coordinated motion", () => {
    const markup = renderToStaticMarkup(
      <CourseCoverImage
        alt=""
        blurDataUrl="data:image/webp;base64,blur"
        sizes="320px"
        src="/cover.webp"
      />
    );

    expect(markup).toContain("scale-105");
  });

  it("animates the visual fallback when the image cannot load", () => {
    const markup = renderToStaticMarkup(
      <CourseCoverImageFallback zoomOnHover />
    );

    expect(markup).toContain("group-hover:scale-[1.04]");
    expect(markup).toContain("transition-transform duration-300");
  });
});
