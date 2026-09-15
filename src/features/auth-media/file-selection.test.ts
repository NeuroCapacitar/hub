import { describe, expect, it } from "vitest";
import { readAuthMediaFileSelection } from "./file-selection";

describe("authentication media file selection", () => {
  it("accepts one image", () => {
    const file = new File(["image"], "access.webp", { type: "image/webp" });

    expect(readAuthMediaFileSelection([file])).toEqual([file]);
  });

  it("accepts multiple images for the upload queue", () => {
    const files = [
      new File(["one"], "one.webp", { type: "image/webp" }),
      new File(["two"], "two.webp", { type: "image/webp" }),
    ];

    expect(readAuthMediaFileSelection(files)).toEqual(files);
  });

  it("rejects an empty selection", () => {
    expect(() => readAuthMediaFileSelection([])).toThrow(
      "Selecione ao menos uma imagem."
    );
  });
});
