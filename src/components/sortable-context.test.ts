import { describe, expect, it } from "vitest";
import {
  createSortableAccessibility,
  getSortableDropPlacement,
} from "./sortable-context";

describe("sortable accessibility", () => {
  it("announces item-specific movement and cancellation", () => {
    const accessibility = createSortableAccessibility((id) => `Aula ${id}`);

    expect(accessibility.screenReaderInstructions?.draggable).toContain(
      "Pressione espaço"
    );
    expect(
      accessibility.announcements?.onDragStart({
        active: { id: "lesson-1" } as never,
      })
    ).toBe("Aula lesson-1 começou a ser movido.");
    expect(
      accessibility.announcements?.onDragEnd({
        active: { id: "lesson-1" } as never,
        over: { id: "lesson-2" } as never,
      })
    ).toBe("Aula lesson-1 foi movido para Aula lesson-2.");
    expect(
      accessibility.announcements?.onDragCancel({
        active: { id: "lesson-1" } as never,
        over: null,
      })
    ).toBe("Aula lesson-1 não foi movido.");
  });

  it("places the insertion marker according to the movement direction", () => {
    expect(
      getSortableDropPlacement({
        activeIndex: 0,
        index: 2,
        isDragging: false,
        isOver: true,
        overIndex: 2,
      })
    ).toBe("after");
    expect(
      getSortableDropPlacement({
        activeIndex: 2,
        index: 0,
        isDragging: false,
        isOver: true,
        overIndex: 0,
      })
    ).toBe("before");
    expect(
      getSortableDropPlacement({
        activeIndex: 1,
        index: 1,
        isDragging: false,
        isOver: true,
        overIndex: 1,
      })
    ).toBeNull();
  });
});
