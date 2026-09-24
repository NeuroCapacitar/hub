import { describe, expect, it, vi } from "vitest";
import { createObjectUrlRegistry } from "./object-url-registry";

describe("object URL registry", () => {
  it("revokes each owned URL once when released or disposed", () => {
    const urlApi = {
      createObjectURL: vi
        .fn()
        .mockReturnValueOnce("blob:first")
        .mockReturnValueOnce("blob:second"),
      revokeObjectURL: vi.fn(),
    };
    const registry = createObjectUrlRegistry(urlApi);
    const first = registry.create(new Blob(["first"]));
    const second = registry.create(new Blob(["second"]));

    registry.revoke(first);
    registry.revoke(first);
    registry.revokeAll();
    registry.revokeAll();

    expect(urlApi.revokeObjectURL.mock.calls).toEqual([
      ["blob:first"],
      ["blob:second"],
    ]);
    expect(first).toBe("blob:first");
    expect(second).toBe("blob:second");
  });
});
