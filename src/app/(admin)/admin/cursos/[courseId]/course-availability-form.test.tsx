import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/course-availability-actions", () => ({
  archiveCourseAction: vi.fn(),
  restoreCourseAction: vi.fn(),
}));

import {
  CourseAvailabilityFields,
  CourseRiskZone,
  getCourseAvailabilityPreset,
} from "./course-availability-form";

const course: Parameters<typeof getCourseAvailabilityPreset>[0] = {
  catalogVisibility: "listed" as const,
  id: "course-1",
  hasCommercialHistory: true,
  interestCount: 3,
  interestNotificationsSent: 5,
  launchDate: null,
  launchLandingUrl: null,
  pendingCheckoutCancellations: 1,
  pendingInterestNotifications: 2,
  salesStatus: "closed" as const,
  status: "active",
};

const renderAvailabilityFields = (
  courseToRender = course,
  readOnly = false
): string =>
  renderToStaticMarkup(
    <CourseAvailabilityFields
      course={courseToRender}
      onPresetChange={() => undefined}
      onShowInCatalogChange={() => undefined}
      preset={getCourseAvailabilityPreset(courseToRender)}
      readOnly={readOnly}
      showInCatalog={courseToRender.catalogVisibility === "listed"}
    />
  );

describe("CourseAvailabilityFields", () => {
  it("shows paused visibility and aggregate interest information", () => {
    const markup = renderAvailabilityFields();

    expect(markup).toContain("Exibir na vitrine");
    expect(markup).not.toContain("Zona de risco");
    expect(markup).not.toContain("Atual:");
    expect(markup).toContain(
      "Rascunho e Em breve estão indisponíveis porque este Curso já possui histórico comercial."
    );
    expect(markup).toContain("3 interessadas");
    expect(markup).toContain("1 cancelamento pendente");
  });

  it("keeps archiving controls in the separate risk zone", () => {
    const markup = renderToStaticMarkup(<CourseRiskZone course={course} />);

    expect(markup).toContain("Arquivar curso");
    expect(markup).not.toContain("Disponibilidade");
  });

  it("shows launch fields for a coming-soon course", () => {
    const markup = renderAvailabilityFields({
      ...course,
      launchDate: "2026-10-01",
      salesStatus: "closed",
      status: "draft",
    });

    expect(markup).toContain("Data prevista");
    expect(markup).toContain("Landing externa");
    expect(markup).toContain("Definir data prevista");
    expect(markup).not.toContain('type="date"');
  });

  it("shows the external landing field while sales are paused", () => {
    const markup = renderAvailabilityFields({
      ...course,
      launchLandingUrl: "https://landing.example/curso-pausado",
    });

    expect(markup).toContain("Landing externa");
    expect(markup).toContain("https://landing.example/curso-pausado");
  });

  it("renders consultation details without save controls", () => {
    const markup = renderAvailabilityFields(course, true);

    expect(markup).toContain("somente para consulta");
    expect(markup).not.toContain("Salvar disponibilidade");
    expect(markup).not.toContain("<form");
  });

  it("keeps restore separate from ordinary availability changes", () => {
    const archivedCourse = {
      ...course,
      catalogVisibility: "hidden" as const,
      status: "archived",
    };
    const markup = renderAvailabilityFields(archivedCourse);

    expect(markup).toContain("Curso arquivado");
    expect(markup).toContain("Restaurar curso");
  });
});
