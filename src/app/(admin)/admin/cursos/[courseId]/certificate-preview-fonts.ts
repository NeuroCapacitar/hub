const CERTIFICATE_FONT_FACES = [
  '400 16px "Certificate Inter"',
  '700 16px "Certificate Inter"',
] as const;
const CERTIFICATE_FONT_SAMPLE = "Ação Responsável 0123456789";

export const loadCertificatePreviewFonts = async (
  fontSet: Pick<FontFaceSet, "load" | "ready">
): Promise<boolean> => {
  try {
    const loadedFaces = await Promise.all(
      CERTIFICATE_FONT_FACES.map((font) =>
        fontSet.load(font, CERTIFICATE_FONT_SAMPLE)
      )
    );
    await fontSet.ready;
    return loadedFaces.every((faces) =>
      faces.some((face) => face.status === "loaded")
    );
  } catch {
    return false;
  }
};
