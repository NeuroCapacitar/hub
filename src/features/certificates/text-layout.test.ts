import PDFDocument from "pdfkit";
import { describe, expect, it } from "vitest";
import { CERTIFICATE_FONT_FILES } from "./font-assets";
import {
  getCertificateTextVerticalOffset,
  layoutCertificateText,
} from "./text-layout";

describe("layoutCertificateText", () => {
  it("wraps at measured widths instead of estimating characters per line", () => {
    const layout = layoutCertificateText({
      lineHeight: 12,
      measureText: (value) => value.length * 10,
      value: "Ana Carolina de Souza",
      width: 80,
    });

    expect(layout.lines).toEqual(["Ana", "Carolina", "de Souza"]);
    expect(layout.contentHeight).toBe(36);
  });

  it("breaks a token wider than the field without splitting graphemes", () => {
    const layout = layoutCertificateText({
      lineHeight: 10,
      measureText: (value) => Array.from(value).length * 10,
      value: "Ação",
      width: 20,
    });

    expect(layout.lines).toEqual(["Aç", "ão"]);
  });

  it("preserves explicit paragraph breaks and empty lines", () => {
    const layout = layoutCertificateText({
      lineHeight: 10,
      measureText: (value) => value.length,
      value: "Linha um\n\nLinha três",
      width: 20,
    });

    expect(layout.lines).toEqual(["Linha um", "", "Linha três"]);
    expect(layout.contentHeight).toBe(30);
  });

  it.each([
    ["Ana Carolina de Souza e Silva", 84],
    ["PRT-1234567890ABCDEF1234567890ABCDEF", 90],
  ])("matches PDFKit line height for representative text: %s", (value, width) => {
    const document = new PDFDocument({ autoFirstPage: false });
    document.font(CERTIFICATE_FONT_FILES.regular).fontSize(14);
    const lineHeight = document.currentLineHeight(true);
    const layout = layoutCertificateText({
      lineHeight,
      measureText: (line) => document.widthOfString(line),
      value,
      width,
    });

    expect(layout.contentHeight).toBeCloseTo(
      document.heightOfString(value, { width }),
      4
    );
  });

  it("returns no lines for empty content", () => {
    expect(
      layoutCertificateText({
        lineHeight: 10,
        measureText: (value) => value.length,
        value: "  ",
        width: 20,
      })
    ).toEqual({ contentHeight: 0, lineHeight: 10, lines: [] });
  });
});

describe("getCertificateTextVerticalOffset", () => {
  it.each([
    ["top", 0],
    ["middle", 20],
    ["bottom", 40],
  ] as const)("aligns content vertically to %s", (verticalAlign, offset) => {
    expect(
      getCertificateTextVerticalOffset({
        contentHeight: 20,
        height: 60,
        verticalAlign,
      })
    ).toBe(offset);
  });

  it("does not produce a negative offset when content exceeds the field", () => {
    expect(
      getCertificateTextVerticalOffset({
        contentHeight: 80,
        height: 60,
        verticalAlign: "middle",
      })
    ).toBe(0);
  });
});
