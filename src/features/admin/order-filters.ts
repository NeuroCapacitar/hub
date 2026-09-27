import { getOrderStatusPresentation } from "./status-presentation";

export const ADMIN_ORDER_STATUS_FILTERS = [
  "pending",
  "paid",
  "refunded",
  "disputed",
  "cancelled",
] as const;

export type AdminOrderStatusFilter =
  (typeof ADMIN_ORDER_STATUS_FILTERS)[number];

export const ADMIN_ORDER_CHECKOUT_FILTERS = [
  { label: "Em criação", value: "creating" },
  { label: "Ativo sem cobrança", value: "active" },
  { label: "Em aberto", value: "open" },
  { label: "Encerrado", value: "closed" },
  { label: "Resultado incerto", value: "uncertain" },
  {
    label: "Pago no Asaas, sem confirmação no Hub",
    value: "paid-awaiting-confirmation",
  },
] as const;

export type AdminOrderCheckoutFilter =
  (typeof ADMIN_ORDER_CHECKOUT_FILTERS)[number]["value"];

export const ADMIN_ORDER_REFUND_FILTERS = [
  { label: "Solicitado ou em processamento", value: "open" },
  { label: "Solicitado", value: "requested" },
  { label: "Em processamento", value: "processing" },
  { label: "Incerto", value: "uncertain" },
  { label: "Falhou", value: "failed" },
  { label: "Confirmado", value: "confirmed" },
] as const;

export type AdminOrderRefundFilter =
  (typeof ADMIN_ORDER_REFUND_FILTERS)[number]["value"];

export const ADMIN_ORDER_PAYMENT_METHOD_FILTERS = [
  { label: "Pix", value: "PIX" },
  { label: "Cartão de crédito", value: "CREDIT_CARD" },
  { label: "Não identificado", value: "UNKNOWN" },
  { label: "Outro", value: "OTHER" },
] as const;

export type AdminOrderPaymentMethodFilter =
  (typeof ADMIN_ORDER_PAYMENT_METHOD_FILTERS)[number]["value"];

export const ADMIN_ORDER_PAYMENT_EVIDENCE_FILTERS = [
  { label: "Pagamento sem vínculo", value: "uncorrelated" },
] as const;

export type AdminOrderPaymentEvidenceFilter =
  (typeof ADMIN_ORDER_PAYMENT_EVIDENCE_FILTERS)[number]["value"];

export const isAdminOrderStatusFilter = (
  value: string
): value is AdminOrderStatusFilter =>
  ADMIN_ORDER_STATUS_FILTERS.includes(value as AdminOrderStatusFilter);

export const isAdminOrderCheckoutFilter = (
  value: string
): value is AdminOrderCheckoutFilter =>
  ADMIN_ORDER_CHECKOUT_FILTERS.some((option) => option.value === value);

export const isAdminOrderRefundFilter = (
  value: string
): value is AdminOrderRefundFilter =>
  ADMIN_ORDER_REFUND_FILTERS.some((option) => option.value === value);

export const isAdminOrderPaymentMethodFilter = (
  value: string
): value is AdminOrderPaymentMethodFilter =>
  ADMIN_ORDER_PAYMENT_METHOD_FILTERS.some((option) => option.value === value);

export const isAdminOrderPaymentEvidenceFilter = (
  value: string
): value is AdminOrderPaymentEvidenceFilter =>
  ADMIN_ORDER_PAYMENT_EVIDENCE_FILTERS.some((option) => option.value === value);

export const getAdminOrderStatusFilterLabel = (
  value: AdminOrderStatusFilter
): string => getOrderStatusPresentation(value).label;

export const getAdminOrderPaymentMethodFilterLabel = (
  value: AdminOrderPaymentMethodFilter
): string =>
  ADMIN_ORDER_PAYMENT_METHOD_FILTERS.find((option) => option.value === value)
    ?.label ?? "Outro";

export const getAdminOrderCheckoutFilterLabel = (
  value: AdminOrderCheckoutFilter
): string =>
  ADMIN_ORDER_CHECKOUT_FILTERS.find((option) => option.value === value)
    ?.label ?? "Checkout";

export const getAdminOrderRefundFilterLabel = (
  value: AdminOrderRefundFilter
): string =>
  ADMIN_ORDER_REFUND_FILTERS.find((option) => option.value === value)?.label ??
  "Reembolso";

export const getAdminOrderPaymentMethodLabel = (
  value: string | null
): string => {
  if (!value?.trim()) {
    return "Método pendente";
  }
  const normalizedValue = value.trim().toUpperCase();
  if (normalizedValue === "PIX") {
    return "Pix";
  }
  if (normalizedValue === "CREDIT_CARD") {
    return "Cartão de crédito";
  }
  if (normalizedValue === "BOLETO") {
    return "Boleto";
  }
  return value;
};
