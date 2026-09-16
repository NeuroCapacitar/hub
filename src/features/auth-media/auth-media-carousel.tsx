"use client";

import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { useMediaQuery } from "@/hooks/use-media-query";
import { PLATFORM_LOGIN_IMAGE_SRC } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { AuthMediaSlide } from "./types";

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";
const AUTOPLAY_DELAY_MS = 6000;
const FALLBACK_SLIDE_ID = "auth-media-fallback";

interface AuthMediaCarouselProps {
  slides: AuthMediaSlide[];
}

export function AuthMediaCarousel({
  slides,
}: AuthMediaCarouselProps): React.JSX.Element | null {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [failedSlideIds, setFailedSlideIds] = useState<Set<string>>(
    () => new Set()
  );
  const [fallbackFailed, setFallbackFailed] = useState(false);

  const autoplay = useMemo(
    () =>
      Autoplay({
        delay: AUTOPLAY_DELAY_MS,
        stopOnFocusIn: false,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      }),
    []
  );

  const availableSlides = useMemo(
    () => slides.filter((slide) => !failedSlideIds.has(slide.id)),
    [failedSlideIds, slides]
  );
  const displaySlides = useMemo(
    () =>
      availableSlides.length > 0
        ? availableSlides
        : [
            {
              blurDataUrl: "",
              id: FALLBACK_SLIDE_ID,
              imageUrl: PLATFORM_LOGIN_IMAGE_SRC,
              sortOrder: 0,
            },
          ],
    [availableSlides]
  );

  const handleApi = useCallback((api: CarouselApi): void => {
    setCarouselApi(api);
  }, []);

  useEffect(() => {
    if (!carouselApi) {
      return;
    }

    const handleSelect = (): void => {
      setSelectedIndex(carouselApi.selectedScrollSnap());
    };

    handleSelect();
    carouselApi.on("reInit", handleSelect);
    carouselApi.on("select", handleSelect);

    return () => {
      carouselApi.off("reInit", handleSelect);
      carouselApi.off("select", handleSelect);
    };
  }, [carouselApi]);

  useEffect(() => {
    if (!carouselApi) {
      return;
    }

    carouselApi.reInit();
    if (carouselApi.selectedScrollSnap() >= displaySlides.length) {
      carouselApi.scrollTo(0, true);
    }
  }, [carouselApi, displaySlides.length]);

  if (!isDesktop) {
    return null;
  }

  const handleImageError = (slide: AuthMediaSlide): void => {
    if (slide.id === FALLBACK_SLIDE_ID) {
      setFallbackFailed(true);
      return;
    }

    setFailedSlideIds((failed) => {
      const next = new Set(failed);
      next.add(slide.id);
      return next;
    });
  };

  return (
    <div className="relative h-full w-full">
      <Carousel
        aria-label="Mídia da tela de acesso"
        className="h-full w-full [&>[data-slot=carousel-content]]:h-full"
        opts={{
          align: "start",
          loop: true,
          watchDrag: displaySlides.length > 1,
        }}
        plugins={displaySlides.length > 1 ? [autoplay] : []}
        setApi={handleApi}
      >
        <CarouselContent className="h-full">
          {displaySlides.map((slide) => (
            <CarouselItem className="relative h-full min-h-full" key={slide.id}>
              <div className="absolute inset-0 overflow-hidden rounded-xl bg-muted ring-1 ring-white/10 ring-inset">
                {slide.id === FALLBACK_SLIDE_ID && fallbackFailed ? (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-muted"
                  />
                ) : (
                  <Image
                    alt=""
                    className="object-cover object-center"
                    fill
                    onError={() => handleImageError(slide)}
                    placeholder={slide.blurDataUrl ? "blur" : "empty"}
                    {...(slide.blurDataUrl
                      ? { blurDataURL: slide.blurDataUrl }
                      : {})}
                    quality={90}
                    sizes="(min-width: 1024px) 56vw, 100vw"
                    src={slide.imageUrl}
                    unoptimized={slide.id !== FALLBACK_SLIDE_ID}
                  />
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {displaySlides.length > 1 ? (
        <div className="absolute inset-x-3 bottom-3 z-10 flex justify-center sm:inset-x-4 sm:bottom-4">
          <div className="relative flex items-center">
            <div
              aria-hidden="true"
              className="absolute inset-x-1 top-1/2 h-4 -translate-y-1/2 rounded-full bg-background/70 shadow-sm"
            />
            <fieldset className="relative flex items-center">
              <legend className="sr-only">Escolher imagem</legend>
              {displaySlides.map((slide, index) => (
                <button
                  aria-current={index === selectedIndex ? "true" : undefined}
                  aria-label={`Mostrar imagem ${index + 1}`}
                  className="group flex size-10 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                  key={slide.id}
                  onClick={() => carouselApi?.scrollTo(index)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-1 rounded-full transition-[background-color,width] duration-300 ease-out group-hover:bg-foreground/80",
                      index === selectedIndex
                        ? "w-4 bg-foreground"
                        : "w-1 bg-muted-foreground/60"
                    )}
                  />
                </button>
              ))}
            </fieldset>
          </div>
        </div>
      ) : null}
    </div>
  );
}
