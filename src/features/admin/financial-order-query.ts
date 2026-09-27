import {
  type AdminOrderCheckoutFilter,
  type AdminOrderPaymentEvidenceFilter,
  type AdminOrderPaymentMethodFilter,
  type AdminOrderRefundFilter,
  type AdminOrderStatusFilter,
  isAdminOrderCheckoutFilter,
  isAdminOrderPaymentEvidenceFilter,
  isAdminOrderPaymentMethodFilter,
  isAdminOrderRefundFilter,
  isAdminOrderStatusFilter,
} from "./order-filters";

export interface AdminFinancialOrderSearchParams {
  checkout?: string | string[] | undefined;
  page?: string | string[] | undefined;
  paymentEvidence?: string | string[] | undefined;
  paymentMethod?: string | string[] | undefined;
  q?: string | string[] | undefined;
  refundStatus?: string | string[] | undefined;
  status?: string | string[] | undefined;
}

export interface AdminFinancialOrderQuery {
  checkout?: AdminOrderCheckoutFilter | undefined;
  page: number;
  paymentEvidence?: AdminOrderPaymentEvidenceFilter | undefined;
  paymentMethod?: AdminOrderPaymentMethodFilter | undefined;
  refundStatus?: AdminOrderRefundFilter | undefined;
  search: string;
  status?: AdminOrderStatusFilter | undefined;
}

export const MAX_ADMIN_FINANCIAL_ORDER_PAGE = 1000;

const readSearchParameter = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

export const getAdminFinancialOrderQuery = (
  searchParams: AdminFinancialOrderSearchParams
): AdminFinancialOrderQuery => {
  const search = readSearchParameter(searchParams.q).trim();
  const requestedCheckout = readSearchParameter(searchParams.checkout).trim();
  const requestedPaymentMethod = readSearchParameter(
    searchParams.paymentMethod
  ).trim();
  const requestedPaymentEvidence = readSearchParameter(
    searchParams.paymentEvidence
  ).trim();
  const requestedRefundStatus = readSearchParameter(
    searchParams.refundStatus
  ).trim();
  const requestedStatus = readSearchParameter(searchParams.status).trim();
  const requestedPage = Number.parseInt(
    readSearchParameter(searchParams.page),
    10
  );

  const status = isAdminOrderStatusFilter(requestedStatus)
    ? requestedStatus
    : undefined;
  const paymentEvidence =
    isAdminOrderPaymentEvidenceFilter(requestedPaymentEvidence) &&
    (!status || status === "paid")
      ? requestedPaymentEvidence
      : undefined;
  const validCheckout = isAdminOrderCheckoutFilter(requestedCheckout)
    ? requestedCheckout
    : undefined;
  const checkoutStatusIsCompatible =
    !paymentEvidence &&
    (validCheckout === "closed"
      ? !status || status === "pending" || status === "cancelled"
      : !status || status === "pending");

  return {
    checkout:
      validCheckout && checkoutStatusIsCompatible ? validCheckout : undefined,
    page:
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? Math.min(MAX_ADMIN_FINANCIAL_ORDER_PAGE, requestedPage)
        : 1,
    paymentMethod: isAdminOrderPaymentMethodFilter(requestedPaymentMethod)
      ? requestedPaymentMethod
      : undefined,
    paymentEvidence,
    refundStatus: isAdminOrderRefundFilter(requestedRefundStatus)
      ? requestedRefundStatus
      : undefined,
    search,
    status,
  };
};
