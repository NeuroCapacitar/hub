/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { StudentCatalogCourseCard } from "@/features/courses/server";
import { CoursePurchaseDialog } from "./course-purchase-dialog";

const course: StudentCatalogCourseCard = {
  accessDurationMonths: 12,
  accessStatus: "none",
  availabilityPreset: "available",
  certificateEnabled: true,
  completedCount: 0,
  courseId: "course-1",
  coverBlurDataUrl: null,
  description: "Uma introdução prática ao tema.",
  expiresAt: null,
  isEnrolled: false,
  isInterested: false,
  launchDate: null,
  launchLandingUrl: null,
  lessonCount: 8,
  moduleCount: 3,
  nextLessonId: null,
  nextReleaseAt: null,
  priceInCents: 15_000,
  paymentAllowCreditCard: true,
  paymentAllowPix: true,
  paymentMaxInstallmentCount: 3,
  progressPercent: 0,
  revokedReason: null,
  slug: "curso-pago",
  thumbnailUrl: null,
  title: "Curso pago de fundamentos",
  totalCount: 8,
  totalDurationSeconds: 7200,
  workloadHours: 2,
};

describe("CoursePurchaseDialog", () => {
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
  });

  it("shows paid course details before linking to checkout", () => {
    act(() => {
      root.render(<CoursePurchaseDialog course={course} />);
    });

    const trigger = container.querySelector("button");
    expect(trigger?.textContent).toContain("Adquirir acesso");

    act(() => {
      trigger?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });

    expect(document.body.textContent).toContain("Curso pago de fundamentos");
    expect(document.body.textContent).toContain("150,00");
    expect(document.body.textContent).toContain("12 meses");
    expect(document.body.textContent).toContain("3 módulos");
    expect(document.body.textContent).toContain("Conteúdo");
    expect(
      Array.from(document.body.querySelectorAll("dt")).map(
        (element) => element.textContent
      )
    ).not.toContain("Módulos");
    expect(document.body.textContent).toContain("2 horas");
    expect(document.body.textContent).toContain("Pix");
    expect(document.body.textContent).toContain("3x");
    expect(document.body.textContent).toContain("Certificado");
    expect(document.body.textContent).toContain("Próxima etapa");
    expect(document.body.textContent).toContain("Comprar agora");

    const checkoutLink = Array.from(document.body.querySelectorAll("a")).find(
      (link) => link.textContent?.includes("Comprar agora")
    );
    expect(checkoutLink?.getAttribute("href")).toBe("/comprar/curso-pago");
  });
});
