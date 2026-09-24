/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/(student)/app/actions", () => ({
  sendSupportRequestAction: vi.fn(),
}));

import { SupportRequestDialog } from "./support-request-dialog";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

describe("SupportRequestDialog", () => {
  let container: HTMLDivElement;
  let root: Root;
  let previousActEnvironment: boolean | undefined;

  beforeEach(() => {
    previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
    if (previousActEnvironment === undefined) {
      Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    } else {
      globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    }
  });

  it("starts with a neutral editable subject for general requests", async () => {
    act(() => root.render(<SupportRequestDialog />));

    const trigger = container.querySelector<HTMLButtonElement>("button");
    expect(trigger).not.toBeNull();

    await act(async () => {
      trigger?.click();
      await Promise.resolve();
    });

    const subject =
      document.querySelector<HTMLInputElement>("#support-subject");
    expect(subject?.value).toBe("Preciso de ajuda");
  });

  it("uses a contextual editable subject when the request is about a course", async () => {
    act(() =>
      root.render(<SupportRequestDialog courseTitle="Sistema PROTEA-R" />)
    );

    const trigger = container.querySelector<HTMLButtonElement>("button");
    expect(trigger).not.toBeNull();

    await act(async () => {
      trigger?.click();
      await Promise.resolve();
    });

    const subject =
      document.querySelector<HTMLInputElement>("#support-subject");
    expect(subject?.value).toBe("Suporte sobre meu curso");
  });
});
