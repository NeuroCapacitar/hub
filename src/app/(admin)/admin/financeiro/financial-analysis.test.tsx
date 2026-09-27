import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { FinancialAnalysis } from "./financial-analysis";

describe("FinancialAnalysis", () => {
  it("dates pending partial-refund notices to the selected period", () => {
    const renderMarkup = (pendingPartialRefundReviewCount: number): string =>
      renderToStaticMarkup(
        <FinancialAnalysis
          analytics={{
            averageConfirmedSaleTicketInCents: 0,
            estimatedNetRevenueInCents: 0,
            feesInCents: 0,
            grossConfirmedSalesInCents: 0,
            missingFeeEvidenceOrders: 0,
            confirmedSaleOrders: 0,
            pendingPartialRefundReviewCount,
            activeCheckoutCount: 0,
            activeCheckoutPotentialInCents: 0,
            period: "30d",
            periodLabel: "Últimos 30 dias",
            providerPaymentDateFallbackOrders: 0,
            refundReceiptsRatioPercent: null,
            refundedOrders: 0,
            refundedRevenueInCents: 0,
          }}
        />
      );

    expect(renderMarkup(1)).toContain(
      "1 revisão de reembolso parcial aberta no período selecionado segue pendente; o valor ainda não foi subtraído"
    );
    expect(renderMarkup(2)).toContain(
      "2 revisões de reembolso parcial abertas no período selecionado seguem pendentes; os valores ainda não foram subtraídos"
    );
    expect(renderMarkup(1)).not.toContain("qualquer data");
  });

  it("explains the period metrics and keeps the estimate explicit", () => {
    const markup = renderToStaticMarkup(
      <FinancialAnalysis
        analytics={{
          averageConfirmedSaleTicketInCents: 5000,
          estimatedNetRevenueInCents: 9000,
          feesInCents: 500,
          grossConfirmedSalesInCents: 10_000,
          missingFeeEvidenceOrders: 0,
          confirmedSaleOrders: 2,
          pendingPartialRefundReviewCount: 0,
          activeCheckoutCount: 2,
          activeCheckoutPotentialInCents: 15_000,
          period: "30d",
          periodLabel: "Últimos 30 dias",
          providerPaymentDateFallbackOrders: 0,
          refundReceiptsRatioPercent: 50,
          refundedOrders: 1,
          refundedRevenueInCents: 500,
        }}
      />
    );

    expect(markup).toContain("Análise por período");
    expect(markup).toContain("Vendas brutas confirmadas");
    expect(markup).toContain("Líquido estimado");
    expect(markup).toContain("Pedidos com pagamento confirmado");
    expect(markup).toContain("Ticket médio confirmado");
    expect(markup).toContain("Potencial em checkouts ativos");
    expect(markup).toContain(
      "2 checkouts ativos sem cobrança registrada no Hub, criados no período"
    );
    expect(markup).not.toContain("Recebimentos em aberto");
    expect(markup).not.toContain("Taxas sobre recebimentos");
    expect(markup).toContain("Reembolsos / recebimentos");
    expect(markup).toContain("150,00");
    expect(markup).toContain("Últimos 30 dias");
    expect(markup).toContain("Ajuda: Análise por período");
    expect(markup).toContain("Valores operacionais do Hub");
    expect(markup).not.toContain("Como interpretar esta análise");
    expect(markup).not.toContain("ainda não sincroniza o calendário");
  });

  it("shows Sem base when the period has no received orders", () => {
    const markup = renderToStaticMarkup(
      <FinancialAnalysis
        analytics={{
          averageConfirmedSaleTicketInCents: 0,
          estimatedNetRevenueInCents: 0,
          feesInCents: 0,
          grossConfirmedSalesInCents: 0,
          missingFeeEvidenceOrders: 0,
          confirmedSaleOrders: 0,
          pendingPartialRefundReviewCount: 0,
          activeCheckoutCount: 0,
          activeCheckoutPotentialInCents: 0,
          period: "all",
          periodLabel: "Todo o histórico",
          providerPaymentDateFallbackOrders: 0,
          refundReceiptsRatioPercent: null,
          refundedOrders: 0,
          refundedRevenueInCents: 0,
        }}
      />
    );

    expect(markup.match(/>Sem base</g)).toHaveLength(2);
    expect(markup).toContain("Resumo financeiro");
    expect(markup).toContain("Indicadores operacionais");
  });
});
