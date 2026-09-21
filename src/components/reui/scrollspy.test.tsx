/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Scrollspy } from "./scrollspy";

describe("Scrollspy", () => {
  let container: HTMLDivElement;
  let root: Root;
  let viewport: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    viewport = document.createElement("div");
    viewport.dataset.slot = "scroll-area-viewport";
    Object.defineProperty(viewport, "clientHeight", { value: 300 });
    Object.defineProperty(viewport, "scrollHeight", { value: 1000 });
    viewport.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    container.append(viewport);
    document.body.append(container);
    root = createRoot(viewport);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("uses the nearest ScrollArea viewport without an explicit targetRef", async () => {
    act(() => {
      root.render(
        <>
          <Scrollspy history={false}>
            <a data-scrollspy-anchor="first" href="#first">
              Primeiro
            </a>
            <a data-scrollspy-anchor="second" href="#second">
              Segundo
            </a>
          </Scrollspy>
          <section
            id="first"
            ref={(element) => {
              if (element) {
                element.getBoundingClientRect = () =>
                  ({ top: -viewport.scrollTop }) as DOMRect;
              }
            }}
          />
          <section
            id="second"
            ref={(element) => {
              if (element) {
                element.getBoundingClientRect = () =>
                  ({ top: 400 - viewport.scrollTop }) as DOMRect;
              }
            }}
          />
        </>
      );
    });

    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    const anchors = viewport.querySelectorAll<HTMLAnchorElement>(
      "[data-scrollspy-anchor]"
    );
    expect(anchors[0]?.dataset.active).toBe("true");

    act(() => {
      viewport.scrollTop = 450;
      viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    expect(anchors[1]?.dataset.active).toBe("true");
    expect(anchors[0]?.dataset.active).toBeUndefined();
  });
});
