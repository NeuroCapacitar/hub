import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    E2E_TEST_MODE: true,
    R2_ACCESS_KEY_ID: "dummy-access-key",
    R2_ACCOUNT_ID: "dummy-account",
    R2_BUCKET_NAME: "dummy-private",
    R2_ENDPOINT: "http://127.0.0.1:4568",
    R2_SECRET_ACCESS_KEY: "dummy-secret-key",
  }),
}));

import { createLessonResourceUploadUrl } from "./r2";

describe("lesson resource write capability", () => {
  it("requires the create-only header in the real SDK signature for both objects", async () => {
    const prepared = await createLessonResourceUploadUrl({
      contentType: "application/pdf",
      fileName: "material.pdf",
      lessonId: "lesson-1",
      preview: {
        contentType: "image/webp",
        height: 180,
        sizeBytes: 7,
        width: 320,
      },
      sizeBytes: 3,
    });

    expect(prepared.previewUploadUrl).toBeDefined();
    for (const url of [prepared.uploadUrl, prepared.previewUploadUrl]) {
      expect(url).toBeDefined();
      const signedHeaders = new URL(url ?? "").searchParams
        .get("X-Amz-SignedHeaders")
        ?.split(";");
      expect(signedHeaders).toContain("if-none-match");
    }
  });
});
