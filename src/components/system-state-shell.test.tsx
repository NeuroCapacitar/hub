import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  SystemStateShell,
  SystemStateSupportReference,
} from "./system-state-shell";

describe("SystemStateShell", () => {
  it("keeps the full-page recovery surface branded and structured", () => {
    const markup = renderToStaticMarkup(
      <SystemStateShell>
        <h1>Não foi possível carregar a página.</h1>
      </SystemStateShell>
    );

    expect(markup).toContain('alt="NeuroCapacitar"');
    expect(markup).toContain("bg-card/90");
    expect(markup).toContain("Não foi possível carregar a página.");
  });

  it("presents a support code without making technical details primary", () => {
    const markup = renderToStaticMarkup(
      <SystemStateSupportReference
        correlationId="correlation-123"
        digest="digest-456"
      />
    );

    expect(markup).toContain("Código de suporte");
    expect(markup).toContain("correlation-123");
    expect(markup).toContain("Copiar código");
    expect(markup).toContain("Mostrar referência técnica");
  });
});
