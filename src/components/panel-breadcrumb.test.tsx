import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PanelBreadcrumb } from "./panel-breadcrumb";

describe("PanelBreadcrumb", () => {
  it("shows only ancestor pages when the current page has a visible heading", () => {
    const markup = renderToStaticMarkup(
      <PanelBreadcrumb
        ancestors={[
          { href: "/admin/operacao", label: "Operação" },
          { label: "Curso" },
        ]}
      />
    );

    expect(markup).toContain("Operação");
    expect(markup).toContain("Curso");
    expect(markup).toContain('href="/admin/operacao"');
    expect(markup).not.toContain('aria-current="page"');
  });

  it("shows the current route label for compact pages without a visible heading", () => {
    const markup = renderToStaticMarkup(
      <PanelBreadcrumb ancestors={[]} currentTitle="Operação diária" />
    );

    expect(markup).toContain("Operação diária");
    expect(markup).toContain('aria-current="page"');
  });

  it("omits the breadcrumb when a root page has its own visible heading", () => {
    const markup = renderToStaticMarkup(<PanelBreadcrumb ancestors={[]} />);

    expect(markup).toBe("");
  });

  it("collapses the middle of a long ancestor path", () => {
    const markup = renderToStaticMarkup(
      <PanelBreadcrumb
        ancestors={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/operacao", label: "Operação" },
          { href: "/admin/operacao/cursos", label: "Cursos" },
          {
            href: "/admin/operacao/cursos/course-1",
            label: "Curso de desenvolvimento",
          },
        ]}
      />
    );

    expect(markup).toContain("Admin");
    expect(markup).toContain("Cursos");
    expect(markup).toContain("Curso de desenvolvimento");
    expect(markup).toContain('aria-label="Mostrar níveis ocultos do caminho"');
    expect(markup).not.toContain('aria-current="page"');
  });
});
