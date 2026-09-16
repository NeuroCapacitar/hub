/**
 * @vitest-environment jsdom
 */

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

import { FreeCourseEnrollmentDialog } from "./free-course-enrollment-dialog";

const COURSE_ID = "11111111-1111-4111-8111-111111111111";

describe("FreeCourseEnrollmentDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("opens an informative free-course confirmation dialog", () => {
    act(() => {
      root.render(
        <FreeCourseEnrollmentDialog
          accessStatus="none"
          courseId={COURSE_ID}
          description="Uma introdução prática ao tema."
          lessonCount={4}
          title="Curso gratuito de fundamentos"
          workloadHours={2}
        />
      );
    });

    expect(document.body.textContent).not.toContain("O que acontece agora?");
    const trigger = container.querySelector("button");
    expect(trigger?.textContent).toContain("Inscrever-se grátis");

    act(() => {
      trigger?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });

    expect(document.body.textContent).toContain(
      "Comece este Curso gratuitamente"
    );
    expect(document.body.textContent).toContain(
      "Curso gratuito de fundamentos"
    );
    expect(document.body.textContent).toContain("4 aulas");
    expect(document.body.textContent).toContain("2h");
    expect(document.body.textContent).toContain("sem cobrança");
    expect(document.body.textContent).toContain("Agora não");
  });

  it("explains when a free access window is being reactivated", () => {
    act(() => {
      root.render(
        <FreeCourseEnrollmentDialog
          accessStatus="expired"
          courseId={COURSE_ID}
          description={null}
          lessonCount={1}
          title="Curso expirado"
          workloadHours={1}
        />
      );
    });

    const trigger = container.querySelector("button");
    expect(trigger?.textContent).toContain("Reativar acesso gratuito");

    act(() => {
      trigger?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });

    expect(document.body.textContent).toContain("Retome seu acesso gratuito");
    expect(document.body.textContent).toContain("Seu acesso anterior expirou");
  });
});
