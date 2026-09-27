import { CERTIFICATE_FONT_LINE_HEIGHT_RATIO } from "@/features/certificates/font-metrics";
import type { CertificateTemplateField } from "@/features/certificates/template-rules";
import { CERTIFICATE_PAGE } from "@/features/certificates/template-rules";

const POINTS_PER_MILLIMETER = 72 / 25.4;
export const CERTIFICATE_PAGE_WIDTH_POINTS =
  CERTIFICATE_PAGE.width * POINTS_PER_MILLIMETER;

export const CERTIFICATE_PREVIEW_LINE_HEIGHT =
  CERTIFICATE_FONT_LINE_HEIGHT_RATIO;

const getVerticalAlignItems = (
  verticalAlign: CertificateTemplateField["verticalAlign"]
): "center" | "flex-end" | "flex-start" => {
  if (verticalAlign === "top") {
    return "flex-start";
  }
  if (verticalAlign === "bottom") {
    return "flex-end";
  }
  return "center";
};

const getHorizontalJustifyContent = (
  align: CertificateTemplateField["align"]
): "center" | "flex-end" | "flex-start" => {
  if (align === "right") {
    return "flex-end";
  }
  if (align === "center") {
    return "center";
  }
  return "flex-start";
};

export const getCertificatePreviewFontSize = (
  fontSizePoints: number,
  renderedWidth: number
): number => (fontSizePoints * renderedWidth) / CERTIFICATE_PAGE_WIDTH_POINTS;

export const getCertificatePreviewFrame = (
  field: CertificateTemplateField
): React.CSSProperties => ({
  height: `${field.height}%`,
  left: `${field.x}%`,
  top: `${field.y}%`,
  width: `${field.width}%`,
});

export const getCertificatePreviewTextStyle = (
  field: CertificateTemplateField,
  renderedWidth: number
): React.CSSProperties => {
  const verticalAlign = field.verticalAlign ?? "middle";
  return {
    ...getCertificatePreviewFrame(field),
    alignItems: getVerticalAlignItems(verticalAlign),
    color: field.color,
    display: "flex",
    fontFamily: "Certificate Inter, sans-serif",
    fontSize: `${
      Math.round(
        getCertificatePreviewFontSize(field.fontSize, renderedWidth) * 1000
      ) / 1000
    }px`,
    fontWeight: field.font === "Helvetica-Bold" ? 700 : 400,
    justifyContent: getHorizontalJustifyContent(field.align),
    lineHeight: CERTIFICATE_PREVIEW_LINE_HEIGHT,
    textAlign: field.align,
  };
};
