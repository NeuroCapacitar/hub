import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogBody: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogClose: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <footer>{children}</footer>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <header>{children}</header>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}));
vi.mock("@/components/ui/hugeicons-icon", () => ({}));
vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => null,
}));
vi.mock("@/features/outbox/actions", () => ({}));
vi.mock("./outbox-dead-letters", () => ({
  OutboxDeadLetterReprocess: () => <span>REPROCESS_FORM</span>,
  OutboxDeadLetterSupersede: () => <span>SUPERSEDE_FORM</span>,
}));

import { OutboxDeadLetterDialog } from "./outbox-dead-letter-dialog";

const message = {
  attempts: 5,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  id: "outbox-1",
  lastErrorAt: new Date("2026-09-02T00:00:00Z"),
  lastErrorCode: "aggregate_not_deliverable",
  topic: "email.support-request",
};

describe("OutboxDeadLetterDialog", () => {
  it("offers explicit closure instead of retry for unavailable support", () => {
    const markup = renderToStaticMarkup(
      <OutboxDeadLetterDialog
        canReprocess={false}
        canRetry
        message={message}
        reprocessBlockedReason="support_request_unavailable"
      />
    );

    expect(markup).toContain(
      "A solicitação de suporte original não está mais disponível"
    );
    expect(markup).toContain("SUPERSEDE_FORM");
    expect(markup).not.toContain("REPROCESS_FORM");
  });

  it("keeps the normal reprocess form for an eligible message", () => {
    const markup = renderToStaticMarkup(
      <OutboxDeadLetterDialog
        canReprocess
        canRetry
        message={message}
        reprocessBlockedReason={null}
      />
    );

    expect(markup).toContain("REPROCESS_FORM");
    expect(markup).not.toContain("SUPERSEDE_FORM");
  });

  it("does not expose recovery actions to an operator without permission", () => {
    const markup = renderToStaticMarkup(
      <OutboxDeadLetterDialog
        canReprocess={false}
        canRetry={false}
        message={message}
        reprocessBlockedReason="support_request_unavailable"
      />
    );

    expect(markup).toContain("Somente Administrador pode reprocessar");
    expect(markup).not.toContain("SUPERSEDE_FORM");
  });
});
