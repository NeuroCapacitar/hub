import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/payments/actions", () => ({
  confirmRefundPasswordAction: vi.fn(),
  importAsaasStatementAction: vi.fn(),
  reconcileAsaasPaymentAction: vi.fn(),
  requestFullRefundAction: vi.fn(),
  resolvePaymentReviewAction: vi.fn(),
  retryFailedAsaasWebhookAction: vi.fn(),
}));

import { FinancialOverview } from "./financial-overview";

describe("FinancialOverview", () => {
  it("keeps the review queue ahead of course revenue and identifies an empty page", () => {
    const markup = renderToStaticMarkup(
      <FinancialOverview
        canExecuteRefund={false}
        canManageFinancialOperations={false}
        canManageFinancialReviews={false}
        canViewOperations={false}
        coursesRevenue={{ courses: [] }}
        financialHealth={{
          closedCheckoutAttempts: 2,
          activeCheckoutCount: 2,
          activeCheckoutPotentialInCents: 20_000,
          checkoutPaidAwaitingConfirmationCount: 0,
          averageConfirmedSaleTicketInCents: 10_000,
          checkoutConversionPercent: 50,
          disputedOrders: 0,
          failedWebhooks: 0,
          paidOrders: 1,
          confirmedSaleOrders: 1,
          grossConfirmedSalesRevenueInCents: 10_000,
          pendingOrders: 0,
          readyWebhooks: 0,
          refundedOrders: 0,
          retryableWebhooks: 0,
          totalOrders: 2,
        }}
        paymentReviews={{
          hasNextPage: false,
          history: [],
          historyTotalCount: 0,
          page: 2,
          pageSize: 20,
          reviews: [],
          totalCount: 1,
        }}
      />
    );

    expect(markup).toContain("Nenhuma revisão nesta página");
    expect(markup).not.toContain("Tudo em ordem");
    expect(markup).not.toContain("Receita sem alerta");
    expect(markup).not.toContain("Integração Asaas sem falhas");
    expect(markup).toContain("Anteriores");
    expect(markup).toContain("Potencial em checkouts ativos");
    expect(markup).toContain("2 checkouts ativos");
    expect(markup).toContain(
      'href="/admin/financeiro?tab=orders&amp;checkout=closed"'
    );
    expect(markup.indexOf("Pendências financeiras")).toBeLessThan(
      markup.indexOf("Receita por curso")
    );
    expect(markup.indexOf("Pendências financeiras")).toBeLessThan(
      markup.indexOf("Vendas brutas confirmadas")
    );
  });

  it("shows the operation destination to Support with operation-view access", () => {
    const markup = renderToStaticMarkup(
      <FinancialOverview
        canExecuteRefund={false}
        canManageFinancialOperations={false}
        canManageFinancialReviews={false}
        canViewOperations
        coursesRevenue={{ courses: [] }}
        financialHealth={{
          activeCheckoutCount: 0,
          activeCheckoutPotentialInCents: 0,
          checkoutPaidAwaitingConfirmationCount: 0,
          averageConfirmedSaleTicketInCents: 0,
          checkoutConversionPercent: 0,
          closedCheckoutAttempts: 0,
          confirmedSaleOrders: 0,
          disputedOrders: 0,
          failedWebhooks: 1,
          paidOrders: 0,
          grossConfirmedSalesRevenueInCents: 0,
          pendingOrders: 0,
          readyWebhooks: 0,
          refundedOrders: 0,
          retryableWebhooks: 0,
          totalOrders: 0,
        }}
        paymentReviews={null}
      />
    );

    expect(markup).toContain("Abrir Operação");
    expect(markup).toContain('href="/admin/operacao"');
    expect(markup).not.toContain("administradora");
  });
});
