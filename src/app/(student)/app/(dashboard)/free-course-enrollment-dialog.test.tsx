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
          certificateEnabled={true}
          courseId={COURSE_ID}
          coverBlurDataUrl={null}
          description="Uma introdução prática ao tema."
          lessonCount={4}
          moduleCount={2}
          thumbnailUrl={null}
          title="Curso gratuito de fundamentos"
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
      "Curso gratuito de fundamentos"
    );
    expect(document.body.textContent).toContain("4 aulas");
    expect(document.body.textContent).toContain("2 módulos");
    expect(document.body.textContent).toContain("Conteúdo");
    expect(
      Array.from(document.body.querySelectorAll("dt")).map(
        (element) => element.textContent
      )
    ).not.toContain("Módulos");
    expect(document.body.textContent).toContain("Certificado");
    expect(document.body.textContent).toContain("sem cobrança");
    expect(document.body.textContent).toContain("O que você recebe");
    expect(document.body.textContent).toContain("Agora não");
  });

  it("explains when a free access window is being reactivated", () => {
    act(() => {
      root.render(
        <FreeCourseEnrollmentDialog
          accessStatus="expired"
          certificateEnabled={false}
          courseId={COURSE_ID}
          coverBlurDataUrl={null}
          description={null}
          lessonCount={1}
          moduleCount={1}
          thumbnailUrl={null}
          title="Curso expirado"
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

    expect(document.body.textContent).toContain("Reativação imediata");
    expect(document.body.textContent).toContain("Seu acesso anterior expirou");
    expect(document.body.textContent).not.toContain("Certificado");
  });
});
