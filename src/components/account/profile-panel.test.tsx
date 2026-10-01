// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AvatarFallback: ({ children }: React.PropsWithChildren) => (
    <span>{children}</span>
  ),
  AvatarImage: ({ alt, src }: { alt: string; src: string }) => (
    <span data-avatar-alt={alt} data-avatar-src={src} />
  ),
}));
vi.mock("@/components/account/avatar-crop-dialog", () => ({
  AvatarCropDialog: () => null,
}));
vi.mock("@/features/account/profile-actions", () => ({
  removeAccountAvatarAction: vi.fn(),
  updateAccountNameAction: vi.fn(),
}));

import { AccountProfilePanel } from "./profile-panel";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const setInputValue = (input: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

let root: Root | null = null;

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  document.body.innerHTML = "";
});

describe("AccountProfilePanel", () => {
  it("shows profile controls without a client-selected owner id", () => {
    const markup = renderToStaticMarkup(
      <AccountProfilePanel
        avatarMode="google"
        image="https://images.example.test/avatar.webp"
        name="Pessoa Exemplo"
      />
    );

    expect(markup).toContain("Pessoa Exemplo");
    expect(markup).not.toContain("userId");
    expect(markup).not.toContain("Usado em novos certificados.");
    expect(markup).toContain("Imagem do perfil");
    expect(markup).toContain("Enviar avatar");
    expect(markup).toContain("size-16");
    expect(markup).not.toContain("JPG, PNG ou WebP · até 5 MiB");
    expect(markup).toContain('aria-label="Selecionar foto de perfil"');
    expect(markup).not.toContain("Remover foto de perfil");
    expect(markup).not.toContain("Usar iniciais");
    expect(markup).not.toContain("Usar foto Google");

    const rendered = document.createElement("div");
    rendered.innerHTML = markup;
    const inputGroup = rendered.querySelector('[data-slot="input-group"]');
    const uploadButton = [...rendered.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("Enviar avatar")
    );
    const saveButton = [...rendered.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Salvar")
    );
    expect(uploadButton?.getAttribute("data-variant")).toBe("default");
    expect(saveButton?.disabled).toBe(true);
    expect(inputGroup?.contains(saveButton ?? null)).toBe(false);
  });

  it("shows avatar removal as a labeled action only for a custom photo", () => {
    const markup = renderToStaticMarkup(
      <AccountProfilePanel
        avatarMode="custom"
        image="/api/account/avatar"
        name="Pessoa"
      />
    );

    expect(markup).toContain("Enviar avatar");
    expect(markup).toContain("Remover");
    expect(markup).not.toContain("Remover foto de perfil");

    const rendered = document.createElement("div");
    rendered.innerHTML = markup;
    const removeButton = [...rendered.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("Remover")
    );
    expect(removeButton?.getAttribute("data-variant")).toBe("destructive");
  });

  it("enables saving only while the normalized name differs", () => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    act(() => {
      root?.render(
        <AccountProfilePanel
          avatarMode="initials"
          image={null}
          name="Pessoa Exemplo"
        />
      );
    });

    const input = host.querySelector<HTMLInputElement>("#account-name");
    const saveButton = [...host.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Salvar")
    );
    expect(saveButton?.disabled).toBe(true);

    act(() => {
      if (input) {
        setInputValue(input, "  Pessoa Nova  ");
      }
    });
    expect(saveButton?.disabled).toBe(false);

    act(() => {
      if (input) {
        setInputValue(input, "Pessoa Exemplo");
      }
    });
    expect(saveButton?.disabled).toBe(true);
  });

  it("keeps the avatar clickable and provides an upload action", () => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => {
      root?.render(
        <AccountProfilePanel
          avatarMode="google"
          image="https://images.example.test/avatar.webp"
          name="Pessoa Exemplo"
        />
      );
    });

    const avatarInput = host.querySelector<HTMLInputElement>("#account-avatar");
    const inputClick = vi.fn();
    avatarInput?.addEventListener("click", inputClick);
    act(() => {
      host
        .querySelector<HTMLLabelElement>('label[for="account-avatar"]')
        ?.click();
    });
    const uploadButton = [...host.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Enviar avatar")
    );
    act(() => {
      uploadButton?.click();
    });

    expect(avatarInput).not.toBeNull();
    expect(inputClick).toHaveBeenCalledTimes(2);
  });

  it("updates the rendered private image source when the refreshed session changes its revision", () => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    act(() => {
      root?.render(
        <AccountProfilePanel
          avatarMode="custom"
          image="/api/account/avatar?revision=first"
          name="Pessoa"
        />
      );
    });

    expect(
      host.querySelector("[data-avatar-src]")?.getAttribute("data-avatar-src")
    ).toBe("/api/account/avatar?revision=first");

    act(() => {
      root?.render(
        <AccountProfilePanel
          avatarMode="custom"
          image="/api/account/avatar?revision=second"
          name="Pessoa"
        />
      );
    });

    expect(
      host.querySelector("[data-avatar-src]")?.getAttribute("data-avatar-src")
    ).toBe("/api/account/avatar?revision=second");
  });
});
