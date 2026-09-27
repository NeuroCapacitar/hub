import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders the page title as the visible primary heading by default", () => {
    const markup = renderToStaticMarkup(
      <PageHeader title="Perguntas frequentes" />
    );

    expect(markup).toContain("<h1");
    expect(markup).toContain("Perguntas frequentes");
  });

  it("supports a compact page that keeps its title in the shell", () => {
    const markup = renderToStaticMarkup(
      <PageHeader title="Operação diária" visibleHeading={false} />
    );

    expect(markup).not.toContain("<h1");
  });

  it("renders a concise description only when one is provided", () => {
    const markup = renderToStaticMarkup(
      <PageHeader
        description="Respostas organizadas para as dúvidas mais comuns."
        title="Perguntas frequentes"
      />
    );

    expect(markup).toContain(
      "Respostas organizadas para as dúvidas mais comuns."
    );
  });
});
