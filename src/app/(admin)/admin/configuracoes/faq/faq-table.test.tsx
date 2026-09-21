/**
 * @vitest-environment jsdom
 */

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const dndHandlers = vi.hoisted(() => ({
  onDragEnd: undefined as ((event: unknown) => void) | undefined,
  reorderFaqsAction: vi.fn(),
}));

vi.mock("@/components/sortable-table-row", () => ({
  SortableTableRow: ({
    ariaLabel,
    children,
  }: {
    ariaLabel?: string;
    children: ReactNode;
  }) => (
    <tr>
      <td>
        <button aria-label={ariaLabel} type="button" />
      </td>
      {children}
    </tr>
  ),
}));
vi.mock("@/features/admin/actions", () => ({
  reorderFaqsAction: dndHandlers.reorderFaqsAction,
}));
vi.mock("./faq-dialogs", () => ({
  FaqDeleteDialog: () => null,
  FaqEditDialog: () => null,
}));
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: ReactNode;
    onDragEnd: (event: unknown) => void;
  }) => {
    dndHandlers.onDragEnd = onDragEnd;
    return <>{children}</>;
  },
  KeyboardSensor: class KeyboardSensor {},
  PointerSensor: class PointerSensor {},
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
}));
vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  arrayMove: vi.fn((items: unknown[], from: number, to: number) => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    if (item !== undefined) {
      next.splice(to, 0, item);
    }
    return next;
  }),
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
}));

import { FaqTable } from "./faq-table";

describe("FaqTable", () => {
  it("renders a semantic table with status and reorder affordance", () => {
    const markup = renderToStaticMarkup(
      <FaqTable
        faqs={[
          {
            answer: "Resposta da pergunta frequente.",
            id: "faq-1",
            isPublished: true,
            question: "Como acessar o curso?",
            sortOrder: 1,
          },
        ]}
      />
    );

    expect(markup).toContain("Perguntas frequentes cadastradas");
    expect(markup).toContain("Reordenação");
    expect(markup).toContain("Publicado");
    expect(markup).toContain('scope="col"');
  });

  it("keeps the empty state inside the FAQ table", () => {
    const markup = renderToStaticMarkup(<FaqTable faqs={[]} />);

    expect(markup).toContain("<table");
    expect(markup).toContain("Perguntas frequentes cadastradas");
    expect(markup).toContain("Nenhuma FAQ cadastrada");
    expect(markup).toContain('scope="col"');
  });

  it("persists a reordered FAQ list", async () => {
    const container = document.createElement("div");
    const root: Root = createRoot(container);
    document.body.append(container);

    act(() => {
      root.render(
        <FaqTable
          faqs={[
            {
              answer: "Primeira resposta.",
              id: "faq-1",
              isPublished: true,
              question: "Primeira pergunta?",
              sortOrder: 1,
            },
            {
              answer: "Segunda resposta.",
              id: "faq-2",
              isPublished: true,
              question: "Segunda pergunta?",
              sortOrder: 2,
            },
          ]}
        />
      );
    });

    expect(container.textContent).toContain("Primeira pergunta?");
    act(() => {
      dndHandlers.onDragEnd?.({
        active: { id: "faq-1" },
        over: { id: "faq-2" },
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(dndHandlers.reorderFaqsAction).toHaveBeenCalledWith([
      "faq-2",
      "faq-1",
    ]);
    act(() => root.unmount());
    container.remove();
  });
});
