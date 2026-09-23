import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COURSE_CARD_GRID_CLASS, CourseCardLayout } from "./course-card-layout";

const VERTICAL_LAYOUT_MARKUP_RE =
  /<div class="[^"]*@container\/course-card[^"]*"><article class="[^"]*\bflex\b[^"]*\bflex-col\b/;
const CONTAINER_ON_ARTICLE_RE = /<article class="[^"]*@container\/course-card/;
const CARD_FILL_HEIGHT_RE = /<article class="[^"]*\bh-full\b/;

describe("CourseCardLayout", () => {
  it("stacks the 16:9 cover, information, and full-width actions", () => {
    const markup = renderToStaticMarkup(
      <CourseCardLayout
        actions={
          <button data-actions="true" type="button">
            Gerenciar
          </button>
        }
        badge={<span data-status="badge">Disponível</span>}
        media={<div data-media />}
      >
        <h3>Curso de exemplo</h3>
      </CourseCardLayout>
    );

    expect(COURSE_CARD_GRID_CLASS).toContain("grid-cols-1");
    expect(COURSE_CARD_GRID_CLASS).toContain("sm:grid-cols-2");
    expect(COURSE_CARD_GRID_CLASS).toContain("xl:grid-cols-3");
    expect(COURSE_CARD_GRID_CLASS).not.toContain("grid-cols-4");
    expect(COURSE_CARD_GRID_CLASS).toContain("items-stretch");
    expect(markup).toMatch(VERTICAL_LAYOUT_MARKUP_RE);
    expect(markup).not.toMatch(CONTAINER_ON_ARTICLE_RE);
    expect(markup).toMatch(CARD_FILL_HEIGHT_RE);
    expect(markup).toContain("p-2");
    expect(markup).toContain(
      'class="flex min-w-0 flex-1 flex-col px-3 pt-3 pb-0"'
    );
    expect(markup).toContain('class="mt-auto min-w-0 px-2 pt-3 pb-3"');
    expect(markup).toContain("aspect-video");
    expect(markup).toContain(
      'class="pointer-events-none absolute top-2 left-2 z-20"'
    );
    expect(markup.indexOf('data-status="badge"')).toBeLessThan(
      markup.indexOf("Curso de exemplo")
    );
    expect(markup).toContain("data-media");
    expect(markup.indexOf("data-media")).toBeLessThan(
      markup.indexOf("Curso de exemplo")
    );
    expect(markup.indexOf('data-actions="true"')).toBeGreaterThan(
      markup.indexOf("Curso de exemplo")
    );
  });

  it("adds calm hover and focus feedback only to interactive cards", () => {
    const renderCard = (interactive: boolean): string =>
      renderToStaticMarkup(
        <CourseCardLayout interactive={interactive} media={<div data-media />}>
          <h3>Curso de exemplo</h3>
        </CourseCardLayout>
      );

    const interactiveMarkup = renderCard(true);
    expect(interactiveMarkup).toContain("hover:border-primary/45");
    expect(interactiveMarkup).toContain("focus-within:border-primary/45");
    expect(interactiveMarkup).toContain("group");
    expect(interactiveMarkup).toContain("transition-[border-color]");
    expect(interactiveMarkup).toContain(
      "transition-[border-color] duration-300 ease-in-out"
    );
    expect(interactiveMarkup).toContain("before:opacity-0");
    expect(interactiveMarkup).toContain(
      "before:transition-opacity before:duration-300 before:ease-in-out"
    );
    expect(interactiveMarkup).toContain("hover:before:opacity-100");
    expect(interactiveMarkup).toContain("focus-within:before:opacity-100");
    expect(interactiveMarkup).not.toContain("hover:-translate");
    expect(interactiveMarkup).not.toContain("group-hover:scale");

    const passiveMarkup = renderCard(false);
    expect(passiveMarkup).toContain("group");
    expect(passiveMarkup).not.toContain("transition-[border-color]");
    expect(passiveMarkup).not.toContain("hover:border-primary/45");
    expect(passiveMarkup).not.toContain("before:content-['']");
  });
});
