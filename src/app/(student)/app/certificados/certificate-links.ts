import type { Route } from "next";
import { route } from "@/lib/routes";

export interface CertificateLinks {
  pdfHref: Route;
  previewHref: Route;
  publicHref: Route;
}

export const getCertificateLinks = ({
  code,
}: {
  code: string;
}): CertificateLinks => {
  const encodedCode = encodeURIComponent(code);
  const publicHref = route(`/certificados/${encodedCode}`);

  return {
    pdfHref: route(`/certificados/${encodedCode}/pdf`),
    previewHref: route(`/certificados/${encodedCode}/preview`),
    publicHref,
  };
};
