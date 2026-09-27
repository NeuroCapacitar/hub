import { describe, expect, it } from "vitest";
import { getPanelPageTitle, getPanelRouteMeta } from "./panel-page-titles";

describe("getPanelPageTitle", () => {
  it("resolves static panel routes", () => {
    expect(getPanelPageTitle("/admin/financeiro")).toBe("Financeiro");
    expect(getPanelPageTitle("/app/configuracoes")).toBe("Configurações");
  });

  it("uses a compact fallback for dynamic routes", () => {
    expect(getPanelPageTitle("/admin/cursos/course-1")).toBe("Curso");
    expect(getPanelPageTitle("/app/aulas/lesson-1")).toBe("Aula");
  });

  it("uses Ajuda as the canonical student support page title", () => {
    expect(getPanelRouteMeta("/app/ajuda")).toEqual({
      ancestors: [],
      title: "Ajuda",
      visibleHeading: true,
    });
  });

  it("provides short ancestors for nested routes", () => {
    expect(getPanelRouteMeta("/admin/cursos/course-1/aulas/lesson-1")).toEqual({
      ancestors: [
        { href: "/admin/cursos", label: "Cursos" },
        { label: "Curso" },
      ],
      visibleHeading: true,
      title: "Aula",
    });
  });

  it("returns to global settings from the design-system reference", () => {
    expect(getPanelRouteMeta("/admin/configuracoes/design-system")).toEqual({
      ancestors: [{ href: "/admin/configuracoes", label: "Configurações" }],
      title: "Sistema visual",
      visibleHeading: true,
    });
  });

  it("keeps dashboards compact while preparing headings for content pages", () => {
    expect(getPanelRouteMeta("/admin").visibleHeading).toBe(false);
    expect(getPanelRouteMeta("/app").visibleHeading).toBe(false);
    expect(getPanelRouteMeta("/app/ajuda").visibleHeading).toBe(true);
    expect(getPanelRouteMeta("/admin/cursos/course-1").visibleHeading).toBe(
      true
    );
  });

  it("uses a student greeting only as the compact home route title", () => {
    const studentDashboardGreeting = "Boa tarde, Júnior.";

    expect(getPanelRouteMeta("/app", { studentDashboardGreeting })).toEqual({
      ancestors: [],
      compactTitle: "Início",
      mobilePageHeading: true,
      title: studentDashboardGreeting,
      visibleHeading: false,
    });
    expect(
      getPanelRouteMeta("/app/ajuda", { studentDashboardGreeting }).title
    ).toBe("Ajuda");
  });

  it("does not apply the student greeting to another compact route", () => {
    expect(
      getPanelRouteMeta("/admin", {
        studentDashboardGreeting: "Boa tarde, Júnior.",
      })
    ).toEqual({
      ancestors: [],
      title: "Operação diária",
      visibleHeading: false,
    });
  });
});
