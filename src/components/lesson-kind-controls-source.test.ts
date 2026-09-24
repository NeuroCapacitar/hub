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
    expect(source).toContain("A ordem é salva junto com a aula.");
    expect(source).toContain('title="Arraste um arquivo aqui"');
    expect(source).toContain('status: "error" | "uploading"');
    expect(source).toContain('role="alert"');
    expect(source).toContain("Tentar novamente");
    expect(source).toContain('name="resourceUploadPending"');
    expect(source).toContain('upload.phase === "uploading"');
  });

  it("clears stale retry progress, exposes one keyboard trigger, and releases local previews", async () => {
    const source = await readFile(
      new URL("./lesson-kind-controls.tsx", import.meta.url),
      "utf8"
    );
    const failureHandler = source.slice(
      source.indexOf("const handleLessonResourceUploadFailure"),
      source.indexOf("const createAndUploadLessonResource")
    );

    expect(source).toContain("progress: undefined");
    expect(source).toContain('className="sr-only"');
    expect(source).toContain(
      'buttonVariants({ size: "sm", variant: "outline" })'
    );
    expect(source).toContain(
      "objectUrlRegistry.revoke(resource.localPreviewUrl)"
    );
    expect(source).toContain("objectUrlRegistry.revokeAll()");
    expect(failureHandler).not.toContain("toast.error");
  });

  it("keeps the attachment editor mounted while its lesson tab is inactive", async () => {
    const source = await readFile(
      new URL(
        "../app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/page.tsx",
        import.meta.url
      ),
      "utf8"
    );
    const attachmentTag = source
      .split("<TabsContent")
      .map((segment) => segment.slice(0, segment.indexOf(">")))
      .find((segment) => segment.includes('value="attachments"'));

    expect(attachmentTag).toBeDefined();
    expect(attachmentTag).toContain("forceMount");
    expect(attachmentTag).toContain("data-[state=inactive]:hidden");
  });
});
