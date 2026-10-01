/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { StaffInvitationAcceptance } from "./invitation-acceptance";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const invitationPreview = {
  invitation: {
    alreadyAccepted: false,
    email: "staff@example.test",
    existingStudent: false,
    expiresAt: "2026-10-06T12:00:00.000Z",
    inviterName: "Admin",
    requiresName: false,
    role: "support",
    willRemovePassword: false,
  },
  status: "ready",
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

const flushEffects = async (): Promise<void> =>
  await new Promise((resolve) => setTimeout(resolve, 0));

let container: HTMLDivElement;
let fetchMock: ReturnType<typeof vi.fn>;
let root: Root | null = null;

const renderAcceptance = async (): Promise<void> => {
  root = createRoot(container);
  await act(async () => {
    root?.render(<StaffInvitationAcceptance />);
    await flushEffects();
  });
};

const clickButton = async (label: string): Promise<void> => {
  const button = [...container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(label)
  );
  expect(button).toBeTruthy();
  await act(async () => {
    button?.click();
    await flushEffects();
  });
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  window.history.replaceState(
    null,
    "",
    "/convites/equipe/aceitar#token=signed-invitation-token"
  );
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("staff invitation acceptance uncertainty", () => {
  it("only performs the read-only preview on page load", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...invitationPreview,
        invitation: { ...invitationPreview.invitation, alreadyAccepted: true },
      })
    );

    await renderAcceptance();

    expect(container.textContent).toContain("Este convite já foi aceito");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/account/staff-invitations/preview"
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
  });

  it("keeps preview retryable after a network failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Network unavailable"));

    await renderAcceptance();

    expect(container.textContent).toContain("Não foi possível validar agora");
    expect(container.textContent).toContain("Tentar novamente");
    expect(container.textContent).not.toContain(
      "Este convite não está mais válido"
    );
  });

  it("keeps acceptance retryable after an HTML 503 without parsing its body", async () => {
    const htmlUnavailable = new Response(
      "<html>temporarily unavailable</html>",
      {
        headers: { "content-type": "text/html" },
        status: 503,
      }
    );
    const parseBody = vi.spyOn(htmlUnavailable, "json");
    fetchMock
      .mockResolvedValueOnce(jsonResponse(invitationPreview))
      .mockResolvedValueOnce(htmlUnavailable)
      .mockResolvedValueOnce(
        new Response("<html>temporarily unavailable</html>", { status: 503 })
      );

    await renderAcceptance();
    await clickButton("Aceitar convite e continuar");

    expect(container.textContent).toContain(
      "Não foi possível confirmar o resultado"
    );
    expect(container.textContent).toContain("Tentar novamente");
    expect(container.textContent).not.toContain(
      "Este convite não está mais válido"
    );
    expect(parseBody).not.toHaveBeenCalled();

    await clickButton("Tentar novamente");
    const acceptanceRequests = fetchMock.mock.calls.slice(1);
    expect(acceptanceRequests).toHaveLength(2);
    expect(acceptanceRequests[0]?.[1]).toMatchObject({
      body: JSON.stringify({ name: "", token: "signed-invitation-token" }),
      method: "POST",
    });
    expect(acceptanceRequests[1]?.[1]).toEqual(acceptanceRequests[0]?.[1]);
  });

  it("keeps acceptance retryable after a network failure", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(invitationPreview))
      .mockRejectedValueOnce(new TypeError("Connection reset"));

    await renderAcceptance();
    await clickButton("Aceitar convite e continuar");

    expect(container.textContent).toContain(
      "Não foi possível confirmar o resultado"
    );
    expect(container.textContent).toContain("Tentar novamente");
  });

  it("keeps malformed successful responses uncertain and retryable", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html>unexpected proxy response</html>", {
        headers: { "content-type": "text/html" },
        status: 200,
      })
    );

    await renderAcceptance();

    expect(container.textContent).toContain("Não foi possível validar agora");
    expect(container.textContent).toContain("Tentar novamente");
  });

  it("treats only the explicit expired-or-invalid response as terminal", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ error: "temporary_gateway_response" }, 400)
      )
      .mockResolvedValueOnce(
        jsonResponse({ error: "invalid_or_expired_staff_invitation" }, 400)
      );

    await renderAcceptance();

    expect(container.textContent).toContain("Não foi possível validar agora");
    expect(container.textContent).toContain("Tentar novamente");

    await clickButton("Tentar novamente");

    expect(container.textContent).toContain(
      "Este convite não está mais válido"
    );
    expect(container.textContent).not.toContain("Tentar novamente");
  });
});
