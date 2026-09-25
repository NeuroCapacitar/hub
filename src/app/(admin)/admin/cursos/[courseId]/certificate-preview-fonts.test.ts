import { describe, expect, it, vi } from "vitest";
import { loadCertificatePreviewFonts } from "./certificate-preview-fonts";

const loadedFontFace = { status: "loaded" } as FontFace;

describe("loadCertificatePreviewFonts", () => {
  it("waits for both Inter weights and document layout before measuring", async () => {
    let resolveReady: ((fontSet: FontFaceSet) => void) | undefined;
    const ready = new Promise<FontFaceSet>((resolve) => {
      resolveReady = resolve;
    });
    const fontSet = {
      load: vi.fn().mockResolvedValue([loadedFontFace]),
      ready,
    };

    const result = loadCertificatePreviewFonts(
      fontSet as unknown as Pick<FontFaceSet, "load" | "ready">
    );

    expect(fontSet.load).toHaveBeenNthCalledWith(
      1,
      '400 16px "Certificate Inter"',
      "Ação Responsável 0123456789"
    );
    expect(fontSet.load).toHaveBeenNthCalledWith(
      2,
      '700 16px "Certificate Inter"',
      "Ação Responsável 0123456789"
    );

    let settled = false;
    const observedResult = result.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    resolveReady?.(fontSet as unknown as FontFaceSet);
    await observedResult;
    await expect(result).resolves.toBe(true);
  });

  it("reports a failed font face instead of trusting fallback metrics", async () => {
    const fontSet = {
      load: vi
        .fn()
        .mockResolvedValueOnce([loadedFontFace])
        .mockResolvedValueOnce([]),
      ready: Promise.resolve({} as FontFaceSet),
    };

    await expect(
      loadCertificatePreviewFonts(
        fontSet as unknown as Pick<FontFaceSet, "load" | "ready">
      )
    ).resolves.toBe(false);
  });
});
