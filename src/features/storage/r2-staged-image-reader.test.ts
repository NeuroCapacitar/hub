import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    R2_ACCESS_KEY_ID: "test-access",
    R2_ACCOUNT_ID: "test-account",
    R2_BUCKET_NAME: "test-private",
    R2_SECRET_ACCESS_KEY: "test-secret",
  }),
}));
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const original = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  return {
    ...original,
    S3Client: class {
      send = state.send;
    },
  };
});

import { readStagedAdminImageFile } from "./r2";
import { buildStagedAdminImageUpload } from "./staged-image-upload";

const reference = buildStagedAdminImageUpload({
  actorUserId: "admin-1",
  aggregateId: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
  contentType: "image/png",
  fileName: "cover.png",
  nonce: "upload",
  purpose: "course-cover",
  sizeBytes: 4,
});
const read = () =>
  readStagedAdminImageFile({
    actorUserId: "admin-1",
    aggregateId: reference.aggregateId,
    purpose: "course-cover",
    reference,
  });
const metadata = {
  ContentLength: 4,
  ContentType: "image/png",
  ETag: '"original"',
};
const objectBody = (bytes: number, cancel = vi.fn()) => ({
  transformToWebStream: () =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(bytes));
        controller.close();
      },
      cancel,
    }),
});

describe("staged image reads", () => {
  beforeEach(() => {
    state.send.mockReset();
    state.send.mockResolvedValueOnce(metadata);
  });

  it("binds GET to the validated ETag before constructing the image", async () => {
    state.send.mockResolvedValueOnce({ ...metadata, Body: objectBody(4) });
    const image = await read();
    expect(image.size).toBe(4);
    expect(state.send.mock.calls[1]?.[0].input).toMatchObject({
      IfMatch: '"original"',
    });
  });

  it("fails closed when the provider rejects a replaced ETag", async () => {
    state.send.mockRejectedValueOnce(new Error("PreconditionFailed"));
    await expect(read()).rejects.toThrow("PreconditionFailed");
    expect(state.send.mock.calls[1]?.[0].input).toMatchObject({
      IfMatch: '"original"',
    });
  });

  it("rejects a changed GET identity even if HEAD metadata was valid", async () => {
    state.send.mockResolvedValueOnce({
      ...metadata,
      ETag: '"replacement"',
      Body: objectBody(4),
    });
    await expect(read()).rejects.toThrow("nao corresponde");
  });

  it.each([
    3, 5,
  ])("rejects actual byte length %i despite matching GET metadata", async (bytes) => {
    state.send.mockResolvedValueOnce({ ...metadata, Body: objectBody(bytes) });
    await expect(read()).rejects.toThrow();
  });

  it("rejects changed content metadata before reading bytes", async () => {
    const transformToWebStream = vi.fn(() => new ReadableStream<Uint8Array>());
    state.send.mockResolvedValueOnce({
      ...metadata,
      ContentType: "application/pdf",
      Body: { transformToWebStream },
    });
    await expect(read()).rejects.toThrow("nao corresponde");
  });

  it("rejects a missing HEAD ETag before GET", async () => {
    state.send.mockReset().mockResolvedValueOnce({
      ContentLength: 4,
      ContentType: "image/png",
    });
    await expect(read()).rejects.toThrow("nao corresponde");
    expect(state.send).toHaveBeenCalledOnce();
  });
});
