import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("LessonVideoControls preview wiring", () => {
  it("updates the shared preview when uploaded JMVStream player url becomes ready", async () => {
    const source = await readFile(
      new URL("./lesson-kind-controls.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("const applyUploadedPlayerUrl =");
    expect(source).toContain("setAppliedEmbedUrl(playerUrl)");
    expect(source).toContain("onPlayerReady={applyUploadedPlayerUrl}");
  });
});

describe("LessonResourcesFields drop behavior", () => {
  it("wires the visible empty state to the lesson resource upload flow", async () => {
    const source = await readFile(
      new URL("./lesson-kind-controls.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("const handleFileDrop =");
    expect(source).toContain("onDrop={handleFileDrop}");
    expect(source).toContain(
      'description="A ordem será salva ao salvar a aula."'
    );
    expect(source).toContain('title="Arraste um arquivo aqui"');
  });
});
