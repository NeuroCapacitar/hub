/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTrigger,
} from "./stepper";

const renderStepper = (defaultValue = 1) => (
  <Stepper aria-label="Etapas do teste" defaultValue={defaultValue}>
    <StepperNav aria-label="Navegação do teste">
      <StepperItem step={1}>
        <StepperTrigger>
          <StepperIndicator>1</StepperIndicator>
        </StepperTrigger>
        <StepperSeparator />
      </StepperItem>
      <StepperItem disabled step={2}>
        <StepperTrigger tabIndex={0}>
          <StepperIndicator>2</StepperIndicator>
        </StepperTrigger>
        <StepperSeparator />
      </StepperItem>
      <StepperItem step={3}>
        <StepperTrigger>
          <StepperIndicator>3</StepperIndicator>
        </StepperTrigger>
      </StepperItem>
    </StepperNav>
    <StepperPanel>
      <StepperContent value={1}>Primeiro</StepperContent>
      <StepperContent value={2}>Segundo</StepperContent>
      <StepperContent value={3}>Terceiro</StepperContent>
    </StepperPanel>
  </Stepper>
);

describe("Stepper", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("connects each tab to a semantic tabpanel with unique ids", () => {
    const document = new DOMParser().parseFromString(
      renderToStaticMarkup(
        <div>
          {renderStepper()}
          {renderStepper()}
        </div>
      ),
      "text/html"
    );
    const tabs = document.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    const panels = document.querySelectorAll<HTMLElement>('[role="tabpanel"]');

    expect(tabs).toHaveLength(6);
    expect(panels).toHaveLength(2);
    expect(new Set(Array.from(tabs, (tab) => tab.id)).size).toBe(6);
    expect(new Set(Array.from(panels, (panel) => panel.id)).size).toBe(2);
    expect(tabs[0]?.getAttribute("aria-controls")).toBe(panels[0]?.id);
    expect(panels[0]?.getAttribute("aria-labelledby")).toBe(tabs[0]?.id);
  });

  it("skips disabled steps when navigating with the keyboard", async () => {
    act(() => {
      root.render(renderStepper());
    });
    await act(async () => {
      await Promise.resolve();
    });

    const firstTab = container.querySelector<HTMLButtonElement>(
      '[role="tab"][aria-selected="true"]'
    );
    if (!firstTab) {
      throw new Error("Active step trigger not found.");
    }

    act(() => {
      firstTab.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" })
      );
    });

    expect(document.activeElement?.getAttribute("aria-controls")).toBe(
      container
        .querySelectorAll<HTMLButtonElement>('[role="tab"]')[2]
        ?.getAttribute("aria-controls")
    );
  });

  it("keeps the first enabled step tabbable when the active step is disabled", async () => {
    act(() => {
      root.render(renderStepper(2));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');

    expect(tabs[0]?.tabIndex).toBe(0);
    expect(tabs[1]?.tabIndex).toBe(-1);
    expect(tabs[2]?.tabIndex).toBe(-1);
  });

  it("activates a step through its click handler from the keyboard", async () => {
    act(() => {
      root.render(renderStepper());
    });
    await act(async () => {
      await Promise.resolve();
    });

    const thirdTab =
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]')[2];
    if (!thirdTab) {
      throw new Error("Third step trigger not found.");
    }

    act(() => {
      thirdTab.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
      );
    });

    expect(thirdTab.getAttribute("aria-selected")).toBe("true");
  });
});
