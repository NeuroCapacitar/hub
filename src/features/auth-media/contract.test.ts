import { describe, expect, it } from "vitest";
import {
  AUTH_MEDIA_MAX_SLIDES,
  buildAuthMediaObjectKey,
  isAuthMediaObjectKey,
  isAuthMediaSlideId,
} from "./contract";

const SLIDE_ID = "c989d54d-d13f-46a1-89ed-2069d7c1c45b";
const VERSION_ID = "44feef7e-1b03-46c4-8119-ad22e5e57826";

describe("authentication media contract", () => {
  it("uses a bounded collection and a stable public object key", () => {
    expect(AUTH_MEDIA_MAX_SLIDES).toBe(5);
    expect(buildAuthMediaObjectKey(SLIDE_ID, VERSION_ID)).toBe(
      `auth-media/${SLIDE_ID}/${VERSION_ID}.webp`
    );
    expect(
      isAuthMediaObjectKey(`auth-media/${SLIDE_ID}/${VERSION_ID}.webp`)
    ).toBe(true);
  });

  it("rejects identifiers and keys outside the media namespace", () => {
    expect(isAuthMediaSlideId("slide-1")).toBe(false);
    expect(isAuthMediaObjectKey("banners/banner.webp")).toBe(false);
    expect(() => buildAuthMediaObjectKey("slide-1", VERSION_ID)).toThrow(
      "Identificador da mídia da tela de acesso inválido."
    );
    expect(isAuthMediaObjectKey(`auth-media/${SLIDE_ID}.webp`)).toBe(false);
  });
});
