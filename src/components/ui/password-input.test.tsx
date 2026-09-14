/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("toggles visibility without changing the input value or metadata", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() =>
      root.render(
        <PasswordInput
          autoComplete="current-password"
          defaultValue="senha-secreta"
          id="password"
          name="password"
        />
      )
    );

    const input = container.querySelector<HTMLInputElement>("input");
    const toggle = container.querySelector<HTMLButtonElement>("button");
    if (!(input && toggle)) {
      throw new Error(
        "Campo de senha ou controle de visibilidade não encontrado."
      );
    }

    expect(input.type).toBe("password");
    expect(input.value).toBe("senha-secreta");
    expect(input.autocomplete).toBe("current-password");
    expect(toggle.getAttribute("aria-label")).toBe("Mostrar senha");

    act(() => toggle.click());
    expect(input.type).toBe("text");
    expect(input.value).toBe("senha-secreta");
    expect(toggle.getAttribute("aria-label")).toBe("Ocultar senha");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    act(() => toggle.click());
    expect(input.type).toBe("password");
    expect(toggle.getAttribute("aria-label")).toBe("Mostrar senha");
    act(() => root.unmount());
  });

  it("disables the visibility control with the password input", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() =>
      root.render(<PasswordInput disabled id="password" name="password" />)
    );

    const input = container.querySelector<HTMLInputElement>("input");
    const toggle = container.querySelector<HTMLButtonElement>("button");
    if (!(input && toggle)) {
      throw new Error(
        "Campo de senha ou controle de visibilidade não encontrado."
      );
    }

    expect(input.disabled).toBe(true);
    expect(toggle.disabled).toBe(true);

    act(() => root.unmount());
  });
});
