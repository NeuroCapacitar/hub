import { getCertificateFontFile } from "./font-assets";
import type { CertificateRenderSnapshot } from "./render-snapshot";
import { layoutCertificateText } from "./text-layout";

export interface CertificatePdfTextMetrics {
  currentLineHeight: (includeGap?: boolean) => number;
  font: (font: string) => unknown;
  fontSize: (size: number) => unknown;
  widthOfString: (value: string) => number;
}

export const layoutCertificatePdfText = (
  document: CertificatePdfTextMetrics,
  field: CertificateRenderSnapshot["template"]["fields"][number],
  value: string,
  width: number
) => {
  document.font(getCertificateFontFile(field.font));
  document.fontSize(field.fontSize);

  const lineHeight = document.currentLineHeight(true);
  return layoutCertificateText({
    lineHeight,
    measureText: (text) => document.widthOfString(text),
    value,
    width,
  });
};
