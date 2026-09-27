import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPublishedFaqItems: vi.fn(),
  requireSession: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: dependencies.redirect }));
vi.mock("@/features/courses/preview", () => ({
  canMutateStudentExperience: () => true,
}));
vi.mock("@/features/courses/server", () => ({
  getPublishedFaqItems: dependencies.getPublishedFaqItems,
}));
vi.mock("@/lib/session", () => ({
  requireSession: dependencies.requireSession,
}));
vi.mock("@/components/support-request-dialog", () => ({
  SupportRequestDialog: ({ triggerLabel }: { triggerLabel: string }) => (
    <button type="button">{triggerLabel}</button>
  ),
}));

import StudentHelpPage from "./page";

describe("StudentHelpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
  });

  it("keeps published answers visible and places the only support entry after them", async () => {
    dependencies.getPublishedFaqItems.mockResolvedValue([
      {
        answer: "Você pode atualizar seu nome nas configurações.",
        id: "faq-1",
        question: "Como atualizo meu nome?",
      },
      {
        answer: "Abra a Aula e selecione os materiais disponíveis.",
        id: "faq-2",
        question: "Onde encontro os materiais?",
      },
    ]);

    const markup = renderToStaticMarkup(await StudentHelpPage());

    expect(markup).toContain("Ajuda");
    expect(markup).toContain(
      "Encontre respostas sobre seus cursos, sua conta e seus pedidos."
    );
    expect(markup).toContain("Como atualizo meu nome?");
    expect(markup).toContain("Você pode atualizar seu nome nas configurações.");
    expect(markup).toContain("Onde encontro os materiais?");
    expect(markup).toContain(
      "Abra a Aula e selecione os materiais disponíveis."
    );
    expect(markup).toContain("Não encontrou sua resposta?");
    expect(markup).toContain(
      "Nossa equipe pode ajudar você a resolver a dúvida."
    );
    expect(markup.match(/Falar com suporte/g)).toHaveLength(1);
    expect(markup.match(/data-slot="frame-panel"/g)).toHaveLength(2);
    expect(markup.match(/data-slot="frame-panel-title"/g)).toHaveLength(2);
    expect(markup).not.toContain('data-slot="accordion"');
  });

  it("keeps a useful empty state with the same support entry", async () => {
    dependencies.getPublishedFaqItems.mockResolvedValue([]);

    const markup = renderToStaticMarkup(await StudentHelpPage());

    expect(markup).toContain("Nenhuma pergunta publicada");
    expect(markup).toContain("Falar com suporte");
  });
});
