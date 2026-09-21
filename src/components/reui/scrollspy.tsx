"use client";

import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";

interface ScrollspyProps {
  children: ReactNode;
  className?: string;
  dataAttribute?: string;
  history?: boolean;
  offset?: number;
  onUpdate?: (id: string) => void;
  smooth?: boolean;
  targetRef?: RefObject<
    HTMLElement | HTMLDivElement | Document | null | undefined
  >;
  throttleTime?: number;
}

type ScrollTargetRef = RefObject<
  HTMLElement | HTMLDivElement | Document | null | undefined
>;

const SCROLL_AREA_VIEWPORT_SELECTOR = '[data-slot="scroll-area-viewport"]';

function getNearestScrollAreaViewport(
  sourceElement: HTMLElement | null
): HTMLElement | null {
  return (
    sourceElement?.closest<HTMLElement>(SCROLL_AREA_VIEWPORT_SELECTOR) ?? null
  );
}

function getScrollElement(
  targetRef: ScrollTargetRef | undefined,
  sourceElement: HTMLElement | null
): HTMLElement | null {
  const target = targetRef?.current;
  if (!target) {
    return (
      getNearestScrollAreaViewport(sourceElement) ?? document.documentElement
    );
  }
  if (target === document) {
    return document.documentElement;
  }

  let element = target as HTMLElement;

  if (!element) {
    return null;
  }

  const viewport = element.matches(SCROLL_AREA_VIEWPORT_SELECTOR)
    ? element
    : element.querySelector<HTMLElement>(SCROLL_AREA_VIEWPORT_SELECTOR);
  if (viewport instanceof HTMLElement) {
    element = viewport;
  }
  return element;
}

function getScrollToElement(
  targetRef: ScrollTargetRef | undefined,
  sourceElement: HTMLElement | null
): HTMLElement | Window | null {
  const target = targetRef?.current;
  if (!target) {
    return getNearestScrollAreaViewport(sourceElement) ?? window;
  }

  if (target === document) {
    return window;
  }

  let element: HTMLElement | Window | null = target as HTMLElement;

  if (element instanceof HTMLElement) {
    const viewport = element.matches(SCROLL_AREA_VIEWPORT_SELECTOR)
      ? element
      : element.querySelector<HTMLElement>(SCROLL_AREA_VIEWPORT_SELECTOR);
    if (viewport instanceof HTMLElement) {
      element = viewport;
    }
  }
  return element;
}

function findActiveAnchorIndex(
  anchors: Element[],
  dataAttribute: string,
  offset: number,
  scrollElement: HTMLElement
): number {
  const scrollTop =
    scrollElement === document.documentElement
      ? window.scrollY || document.documentElement.scrollTop
      : scrollElement.scrollTop;
  let activeIdx = 0;
  let minDelta = Number.POSITIVE_INFINITY;

  for (let idx = 0; idx < anchors.length; idx++) {
    const anchor = anchors[idx];
    if (!anchor) {
      continue;
    }
    const sectionId = anchor.getAttribute(`data-${dataAttribute}-anchor`);
    if (!sectionId) {
      continue;
    }
    const sectionElement = document.getElementById(sectionId);
    if (!sectionElement) {
      continue;
    }

    let customOffset = offset;
    const dataOffset = anchor.getAttribute(`data-${dataAttribute}-offset`);
    if (dataOffset) {
      customOffset = Number.parseInt(dataOffset, 10);
    }

    const sectionTop = getSectionScrollTop(sectionElement, scrollElement);
    const delta = Math.abs(sectionTop - customOffset - scrollTop);
    if (sectionTop - customOffset <= scrollTop && delta < minDelta) {
      minDelta = delta;
      activeIdx = idx;
    }
  }
  return activeIdx;
}

function getSectionScrollTop(
  sectionElement: HTMLElement,
  scrollElement: HTMLElement
): number {
  if (scrollElement === document.documentElement) {
    return sectionElement.offsetTop;
  }

  const scrollRect = scrollElement.getBoundingClientRect();
  const sectionRect = sectionElement.getBoundingClientRect();
  return scrollElement.scrollTop + sectionRect.top - scrollRect.top;
}

function performScrollTo(
  anchorElement: HTMLElement,
  dataAttribute: string,
  offset: number,
  smooth: boolean,
  targetRef: ScrollTargetRef | undefined,
  sourceElement: HTMLElement | null
): string | null {
  const sectionId =
    anchorElement
      .getAttribute(`data-${dataAttribute}-anchor`)
      ?.replace("#", "") || null;
  if (!sectionId) {
    return null;
  }

  const sectionElement = document.getElementById(sectionId);
  if (!sectionElement) {
    return null;
  }

  const scrollToElement = getScrollToElement(targetRef, sourceElement);
  const scrollElement = getScrollElement(targetRef, sourceElement);

  let customOffset = offset;
  const dataOffset = anchorElement.getAttribute(`data-${dataAttribute}-offset`);
  if (dataOffset) {
    customOffset = Number.parseInt(dataOffset, 10);
  }

  const scrollTop = scrollElement
    ? getSectionScrollTop(sectionElement, scrollElement) - customOffset
    : sectionElement.offsetTop - customOffset;

  if (scrollToElement && "scrollTo" in scrollToElement) {
    scrollToElement.scrollTo({
      top: scrollTop,
      left: 0,
      behavior: smooth ? "smooth" : "auto",
    });
  }
  return sectionId;
}

export function Scrollspy({
  children,
  targetRef,
  onUpdate,
  className,
  offset = 0,
  smooth = true,
  dataAttribute = "scrollspy",
  history = true,
}: ScrollspyProps) {
  const selfRef = useRef<HTMLDivElement | null>(null);
  const anchorElementsRef = useRef<Element[] | null>(null);
  const prevIdTracker = useRef<string | null>(null);

  const setActiveSection = useCallback(
    (sectionId: string | null, force = false) => {
      if (!sectionId) {
        return;
      }
      for (const item of anchorElementsRef.current ?? []) {
        const id = item.getAttribute(`data-${dataAttribute}-anchor`);
        if (id === sectionId) {
          item.setAttribute("data-active", "true");
        } else {
          item.removeAttribute("data-active");
        }
      }
      if (onUpdate) {
        onUpdate(sectionId);
      }
      if (history && (force || prevIdTracker.current !== sectionId)) {
        window.history.replaceState({}, "", `#${sectionId}`);
      }
      prevIdTracker.current = sectionId;
    },
    [dataAttribute, history, onUpdate]
  );

  const handleScroll = useCallback(() => {
    const anchors = anchorElementsRef.current;
    if (!anchors || anchors.length === 0) {
      return;
    }

    const scrollElement = getScrollElement(targetRef, selfRef.current);
    if (!scrollElement) {
      return;
    }

    const scrollTop =
      scrollElement === document.documentElement
        ? window.scrollY || document.documentElement.scrollTop
        : scrollElement.scrollTop;

    let activeIdx = findActiveAnchorIndex(
      anchors,
      dataAttribute,
      offset,
      scrollElement
    );

    const scrollHeight = scrollElement.scrollHeight;
    const clientHeight = scrollElement.clientHeight;

    if (scrollTop + clientHeight >= scrollHeight - 2) {
      activeIdx = anchors.length - 1;
    }

    const activeAnchor = anchors[activeIdx];
    const sectionId =
      activeAnchor?.getAttribute(`data-${dataAttribute}-anchor`) || null;

    setActiveSection(sectionId);
  }, [targetRef, dataAttribute, offset, setActiveSection]);

  const scrollTo = useCallback(
    (anchorElement: HTMLElement) => (event?: Event) => {
      if (event) {
        event.preventDefault();
      }
      const sectionId = performScrollTo(
        anchorElement,
        dataAttribute,
        offset,
        smooth,
        targetRef,
        selfRef.current
      );
      if (sectionId) {
        setActiveSection(sectionId, true);
      }
    },
    [dataAttribute, offset, smooth, targetRef, setActiveSection]
  );

  const scrollToHashSection = useCallback(() => {
    const hash = CSS.escape(window.location.hash.replace("#", ""));
    if (hash) {
      const targetElement = document.querySelector(
        `[data-${dataAttribute}-anchor="${hash}"]`
      ) as HTMLElement;
      if (targetElement) {
        scrollTo(targetElement)();
      }
    }
  }, [dataAttribute, scrollTo]);

  useEffect(() => {
    if (selfRef.current) {
      anchorElementsRef.current = Array.from(
        selfRef.current.querySelectorAll(`[data-${dataAttribute}-anchor]`)
      );
    }

    const currentAnchors = anchorElementsRef.current ?? [];
    for (const item of currentAnchors) {
      item.addEventListener("click", scrollTo(item as HTMLElement));
    }

    const onScroll = (event: Event) => {
      const scrollElement = getScrollElement(targetRef, selfRef.current);
      if (!scrollElement) {
        return;
      }

      if (
        scrollElement === document.documentElement ||
        scrollElement.contains(event.target as Node)
      ) {
        handleScroll();
      }
    };

    window.addEventListener("scroll", onScroll, true);

    const initialTimeout = setTimeout(() => {
      scrollToHashSection();
      handleScroll();
    }, 100);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      for (const item of currentAnchors) {
        item.removeEventListener("click", scrollTo(item as HTMLElement));
      }
      clearTimeout(initialTimeout);
    };
  }, [targetRef, handleScroll, dataAttribute, scrollTo, scrollToHashSection]);

  return (
    <div className={className} data-slot="scrollspy" ref={selfRef}>
      {children}
    </div>
  );
}
