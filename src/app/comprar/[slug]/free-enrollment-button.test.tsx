/**
 * @vitest-environment jsdom
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  enrollFreeCourseAction: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: dependencies.push }),
}));
vi.mock("@/app/(student)/app/actions", () => ({
  enrollFreeCourseAction: dependencies.enrollFreeCourseAction,
}));

import { FreeEnrollmentButton } from "./free-enrollment-button";

const COURSE_ID = "11111111-1111-4111-8111-111111111111";
const FORBIDDEN_CLIENT_TRANSPORT_PATTERN =
  /fetch|localStorage|sessionStorage|\/api\/checkouts\/course|polling/i;

describe("FreeEnrollmentButton", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    dependencies.enrollFreeCourseAction.mockResolvedValue({
      courseId: COURSE_ID,
      ok: true,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("submits only the Course id and navigates after a successful action", async () => {
    act(() => {
      root.render(<FreeEnrollmentButton courseId={COURSE_ID} />);
    });

    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      await Promise.resolve();
    });

    expect(dependencies.enrollFreeCourseAction).toHaveBeenCalledOnce();
    const submittedFormData =
      dependencies.enrollFreeCourseAction.mock.calls[0]?.[0];
    expect(submittedFormData).toBeInstanceOf(FormData);
    expect(submittedFormData.get("courseId")).toBe(COURSE_ID);
    expect(dependencies.push).toHaveBeenCalledWith(`/app/cursos/${COURSE_ID}`);
  });

  it("shows a safe action error without navigating", async () => {
    dependencies.enrollFreeCourseAction.mockResolvedValue({
      message: "Preço diferente de zero.",
      ok: false,
    });
    act(() => {
      root.render(<FreeEnrollmentButton courseId={COURSE_ID} />);
    });

    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Preço diferente de zero."
    );
    expect(dependencies.push).not.toHaveBeenCalled();
  });

  it("disables the button while its own action is pending", async () => {
    let resolveAction:
      | ((value: { courseId: string; ok: true }) => void)
      | undefined;
    dependencies.enrollFreeCourseAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        })
    );
    act(() => {
      root.render(<FreeEnrollmentButton courseId={COURSE_ID} />);
    });

    const form = container.querySelector("form");
    act(() => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
    });
    expect(container.querySelector("button")?.disabled).toBe(true);

    if (!resolveAction) {
      throw new Error("A action não foi iniciada.");
    }
    const resolve = resolveAction;
    await act(async () => {
      resolve({ courseId: COURSE_ID, ok: true });
      await Promise.resolve();
    });
    expect(dependencies.push).toHaveBeenCalledWith(`/app/cursos/${COURSE_ID}`);
  });

  it("does not contain Checkout transport or client-side persistence", async () => {
    const source = await readFile(
      resolve(
        process.cwd(),
        "src/app/comprar/[slug]/free-enrollment-button.tsx"
      ),
      "utf8"
    );

    expect(source).toContain("useTransition");
    expect(source).not.toMatch(FORBIDDEN_CLIENT_TRANSPORT_PATTERN);
  });
});
