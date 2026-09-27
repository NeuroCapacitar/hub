import { FinanceHelp } from "@/components/admin/finance-help";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AdminFinancialAnalytics } from "@/features/admin/server";
import { formatCurrencyInCents } from "@/lib/formatters";
import { AdminMetricCard } from "../admin-metric-card";
import { FinancialPeriodSelect } from "./financial-period-select";

const formatPercent = (value: number | null): string =>
  value === null
    ? "Sem base"
    : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const formatCurrencyWithBase = (value: number, denominator: number): string =>
  denominator > 0 ? formatCurrencyInCents(value) : "Sem base";

const getFeeHelper = (analytics: AdminFinancialAnalytics): string =>
  analytics.missingFeeEvidenceOrders > 0
    ? `${analytics.missingFeeEvidenceOrders} pedido${analytics.missingFeeEvidenceOrders === 1 ? "" : "s"} sem taxa ou líquido completo; estimativa parcial.`
    : "Taxas identificadas nos snapshots de pagamento.";

const getNetHelper = (analytics: AdminFinancialAnalytics): string => {
  const warnings: string[] = [];
  if (analytics.missingFeeEvidenceOrders > 0) {
    warnings.push(
      `${analytics.missingFeeEvidenceOrders} pedido${analytics.missingFeeEvidenceOrders === 1 ? "" : "s"} sem evidência completa de taxa/líquido`
    );
  }
  if (analytics.pendingPartialRefundReviewCount > 0) {
    warnings.push(
      `${analytics.pendingPartialRefundReviewCount} revisão${analytics.pendingPartialRefundReviewCount === 1 ? "" : "ões"} de reembolso parcial pendente${analytics.pendingPartialRefundReviewCount === 1 ? "" : "s"} (qualquer data); valor ainda não subtraído`
    );
  }
  return warnings.length
    ? `Estimativa incompleta: ${warnings.join("; ")}.`
    : "Estimativa após taxas e reembolsos confirmados.";
};

const getPaymentDateHelper = (analytics: AdminFinancialAnalytics): string =>
  analytics.providerPaymentDateFallbackOrders > 0
    ? `${analytics.providerPaymentDateFallbackOrders} pedido${analytics.providerPaymentDateFallbackOrders === 1 ? " usa" : "s usam"} a data de confirmação no Hub porque o Asaas não informou a data do pagamento.`
    : "O período usa a data do pagamento informada pelo Asaas.";

export function FinancialAnalysis({
  analytics,
}: {
  analytics: AdminFinancialAnalytics;
}): React.JSX.Element {
  const averageConfirmedSaleTicket = formatCurrencyWithBase(
    analytics.averageConfirmedSaleTicketInCents,
    analytics.confirmedSaleOrders
  );
  const refundReceiptsRatio = formatPercent(
    analytics.refundReceiptsRatioPercent
  );
  const feeHelper = getFeeHelper(analytics);
  const netHelper = getNetHelper(analytics);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <CardTitle as="h2" className="text-base">
                Análise por período
              </CardTitle>
              <FinanceHelp
                description="Consulte como cada indicador é calculado, quais dados entram e quais são os limites desta análise."
                details={[
                  "Cada Pedido com pagamento confirmado entra uma vez, inclusive quando a compra é parcelada; o valor total da compra não é dividido em parcelas.",
                  "Vendas brutas confirmadas incluem Pedidos pagos, reembolsados ou em disputa que preservam evidência de pagamento. A data do Asaas é preferida; quando ausente, usamos a confirmação registrada no Hub.",
                  "O ticket médio usa o valor total confirmado do Pedido, não uma parcela isolada.",
                  "O potencial considera apenas Pedidos do período com link de Checkout ativo no Hub; isso não comprova cobrança criada, pagamento em andamento ou recebível.",
                  "Reembolsos usam a data de confirmação registrada. A relação Reembolsos / recebimentos compara contagens do período, não uma coorte, e pode superar 100%.",
                  "O líquido é uma estimativa baseada nos dados salvos no Hub. Revisões de reembolso parcial pendentes ainda não têm um valor confiável subtraído.",
                  "Os indicadores não representam o saldo disponível no Asaas. Para conciliação oficial, confira o Asaas e os detalhes da cobrança; cobranças individuais aparecem quando são sincronizadas.",
                ]}
                title="Análise por período"
              />
            </div>
            <CardDescription className="mt-1">
              <span className="block">
                {analytics.periodLabel}: compare desempenho, pendências e
                reembolsos.
              </span>
              <span className="block text-xs">
                Valores operacionais do Hub; não representam o saldo disponível
                no Asaas.
              </span>
              <span className="block text-xs">
                {getPaymentDateHelper(analytics)}
              </span>
            </CardDescription>
          </div>
          <FinancialPeriodSelect value={analytics.period} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-8">
        <section
          aria-labelledby="financial-analysis-summary-title"
          className="grid gap-3"
        >
          <div className="grid gap-1">
            <h3
              className="type-card-title"
              id="financial-analysis-summary-title"
            >
              Resumo financeiro
            </h3>
            <p className="type-body-sm text-muted-foreground">
              Totais do período, com o líquido apresentado como estimativa.
            </p>
          </div>
          <div className="grid gap-x-4 gap-y-12 sm:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              helper={`${analytics.confirmedSaleOrders} pedido${analytics.confirmedSaleOrders === 1 ? "" : "s"} com evidência de pagamento; valor bruto antes de taxas e reembolsos.`}
              label="Vendas brutas confirmadas"
              value={formatCurrencyInCents(
                analytics.grossConfirmedSalesInCents
              )}
            />
            <AdminMetricCard
              helper={feeHelper}
              label="Taxas identificadas"
              value={formatCurrencyInCents(analytics.feesInCents)}
            />
            <AdminMetricCard
              helper={`${analytics.refundedOrders} pedido${analytics.refundedOrders === 1 ? "" : "s"} com reembolso confirmado.`}
              label="Reembolsos confirmados"
              value={formatCurrencyInCents(analytics.refundedRevenueInCents)}
            />
            <AdminMetricCard
              helper={netHelper}
              label="Líquido estimado"
              value={formatCurrencyInCents(
                analytics.estimatedNetRevenueInCents
              )}
            />
          </div>
        </section>
        <section
          aria-labelledby="financial-analysis-operational-title"
          className="grid gap-3 border-t pt-6"
        >
          <div className="grid gap-1">
            <h3
              className="type-card-title"
              id="financial-analysis-operational-title"
            >
              Indicadores operacionais
            </h3>
            <p className="type-body-sm text-muted-foreground">
              Volume, média, pendências e proporção de reembolsos do período.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              helper="Pedidos com evidência de pagamento no período."
              label="Pedidos com pagamento confirmado"
              value={analytics.confirmedSaleOrders.toString()}
            />
            <AdminMetricCard
              helper="Vendas brutas confirmadas divididas pelos pedidos com pagamento confirmado."
              label="Ticket médio confirmado"
              value={averageConfirmedSaleTicket}
            />
            <AdminMetricCard
              helper={`${analytics.activeCheckoutCount} checkout${analytics.activeCheckoutCount === 1 ? "" : "s"} ativo${analytics.activeCheckoutCount === 1 ? "" : "s"} sem cobrança registrada no Hub, criado${analytics.activeCheckoutCount === 1 ? "" : "s"} no período; valor nominal.`}
              label="Potencial em checkouts ativos"
              value={formatCurrencyInCents(
                analytics.activeCheckoutPotentialInCents
              )}
            />
            <AdminMetricCard
              helper={`${analytics.refundedOrders} reembolso${analytics.refundedOrders === 1 ? "" : "s"} confirmado${analytics.refundedOrders === 1 ? "" : "s"} / ${analytics.confirmedSaleOrders} pedido${analytics.confirmedSaleOrders === 1 ? "" : "s"} com pagamento confirmado neste período. Relação por contagem, não por coorte; pode superar 100%.`}
              label="Reembolsos / recebimentos"
              value={refundReceiptsRatio}
            />
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
