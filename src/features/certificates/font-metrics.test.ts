import PDFDocument from "pdfkit";
import { describe, expect, it } from "vitest";
import { CERTIFICATE_FONT_FILES } from "./font-assets";
import {
  CERTIFICATE_FONT_ASCENDER_RATIO,
  CERTIFICATE_FONT_LINE_HEIGHT_RATIO,
} from "./font-metrics";

const getInterMetrics = (fontFile: string) => {
  const document = new PDFDocument({ autoFirstPage: false });
  document.font(fontFile).fontSize(1000);
  const font = (
    document as unknown as {
      _font: { ascender: number };
    }
  )._font;

  return {
    ascenderRatio: font.ascender / 1000,
    lineHeightRatio: document.currentLineHeight(true) / 1000,
  };
};

describe("certificate Inter metrics", () => {
  it.each([
    CERTIFICATE_FONT_FILES.regular,
    CERTIFICATE_FONT_FILES.bold,
  ])("matches the bundled TTF metrics for %s", (fontFile) => {
    expect(getInterMetrics(fontFile)).toEqual({
      ascenderRatio: CERTIFICATE_FONT_ASCENDER_RATIO,
      lineHeightRatio: CERTIFICATE_FONT_LINE_HEIGHT_RATIO,
    });
  });
});
