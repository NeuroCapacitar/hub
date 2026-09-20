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

  it("provides short ancestors for nested routes", () => {
    expect(getPanelRouteMeta("/admin/cursos/course-1/aulas/lesson-1")).toEqual({
      ancestors: [
        { href: "/admin/cursos", label: "Cursos" },
        { label: "Curso" },
      ],
      title: "Aula",
    });
  });
});
