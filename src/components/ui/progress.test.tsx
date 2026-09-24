import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Progress } from "./progress";

describe("Progress", () => {
  it("exposes the measured value to assistive technology", () => {
    const markup = renderToStaticMarkup(
      <Progress aria-label="Progresso obrigatório" value={37} />
    );

    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-label="Progresso obrigatório"');
    expect(markup).toContain('aria-valuenow="37"');
  });
});
