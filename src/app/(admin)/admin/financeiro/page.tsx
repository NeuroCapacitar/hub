import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import {
  type AdminFinancialOrderSearchParams,
  getAdminFinancialOrderQuery,
} from "@/features/admin/financial-order-query";
import {
  type AdminFinancialPeriod,
  isAdminFinancialPeriod,
} from "@/features/admin/financial-period";
import {
  getAdminFinancialAnalysisData,
  getAdminFinancialOrdersData,
  getAdminFinancialOverviewData,
  getAdminStatementImportHistory,
  getAdminStatementImportProgress,
} from "@/features/admin/server";
import { requirePermission } from "@/lib/auth-permissions";
import { canPerform } from "@/lib/auth-policy";
import { FinancialAnalysis } from "./financial-analysis";
import { FinancialOrdersTable } from "./financial-orders-table";
import { FinancialOverview } from "./financial-overview";
import { FinancialOperationsMenu } from "./financial-statement-import";
import { FinancialTabs } from "./financial-tabs";

export const dynamic = "force-dynamic";

const readSearchParameter = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

interface FinancialSearchParams extends AdminFinancialOrderSearchParams {
  period?: string | string[] | undefined;
  reviewPage?: string | string[] | undefined;
  tab?: string | string[] | undefined;
}

const getReviewPage = (searchParams: FinancialSearchParams): number => {
  const requestedPage = Number.parseInt(
    readSearchParameter(searchParams.reviewPage),
    10
  );

  return Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? requestedPage
    : 1;
};

const getFinancialPeriod = (
  searchParams: FinancialSearchParams
): AdminFinancialPeriod => {
  const requestedPeriod = readSearchParameter(searchParams.period).trim();
  return isAdminFinancialPeriod(requestedPeriod) ? requestedPeriod : "all";
};

type AdminFinancialTab = "analysis" | "orders" | "overview";

const getActiveFinancialTab = (
  requestedTab: string,
  visibleTabs: Readonly<Record<AdminFinancialTab, boolean>>
): AdminFinancialTab => {
  if (requestedTab === "analysis" && visibleTabs.analysis) {
    return "analysis";
  }
  if (requestedTab === "orders" && visibleTabs.orders) {
    return "orders";
  }
  if (visibleTabs.overview) {
    return "overview";
  }
  if (visibleTabs.orders) {
    return "orders";
  }
  return "analysis";
};

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<FinancialSearchParams>;
}): Promise<React.JSX.Element> {
  const session = await requirePermission("viewFinancials");
  const resolvedSearchParams = await searchParams;
  const {
    page: orderPage,
    checkout: orderCheckout,
    paymentEvidence: orderPaymentEvidence,
    paymentMethod: orderPaymentMethod,
    search: orderSearch,
    status: orderStatus,
    refundStatus: orderRefundStatus,
  } = getAdminFinancialOrderQuery(resolvedSearchParams);
  const reviewPage = getReviewPage(resolvedSearchParams);
  const financialPeriod = getFinancialPeriod(resolvedSearchParams);
  const requestedTab = readSearchParameter(resolvedSearchParams.tab).trim();
  const canViewFinancialAnalysis = canPerform(session, "viewFinancialAnalysis");
  const canViewFinancialOrders = canPerform(session, "viewFinancialOrders");
  const canViewFinancialReviews = canPerform(session, "viewFinancialReviews");
  const visibleTabs = {
    analysis: canViewFinancialAnalysis,
    orders: canViewFinancialOrders,
    overview: canViewFinancialAnalysis || canViewFinancialReviews,
  } as const;
  const activeTab = getActiveFinancialTab(requestedTab, visibleTabs);
  const canManageFinancialOperations = canPerform(
    session,
    "manageFinancialOperations"
  );
  const canManageFinancialReviews = canPerform(
    session,
    "manageFinancialReviews"
  );
  const canViewOperations = canPerform(session, "viewOperations");
  const canExecuteRefund = canPerform(session, "executeRefund");

  const [
    overviewData,
    ordersData,
    analysisData,
    statementImportHistory,
    statementImportProgress,
  ] = await Promise.all([
    activeTab === "overview"
      ? getAdminFinancialOverviewData({ page: reviewPage })
      : Promise.resolve(null),
    activeTab === "orders"
      ? getAdminFinancialOrdersData({
          checkout: orderCheckout,
          page: orderPage,
          paymentEvidence: orderPaymentEvidence,
          paymentMethod: orderPaymentMethod,
          refundStatus: orderRefundStatus,
          search: orderSearch,
          status: orderStatus,
        })
      : Promise.resolve(null),
    activeTab === "analysis"
      ? getAdminFinancialAnalysisData(financialPeriod)
      : Promise.resolve(null),
    canManageFinancialOperations
      ? getAdminStatementImportHistory()
      : Promise.resolve([]),
    canManageFinancialOperations
      ? getAdminStatementImportProgress()
      : Promise.resolve(null),
  ]);
  if (activeTab === "overview" && !overviewData) {
    throw new Error("Projeção financeira ativa ausente.");
  }
  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader
          actions={
            canManageFinancialOperations ? (
              <FinancialOperationsMenu
                statementImportHistory={statementImportHistory}
                statementImportProgress={statementImportProgress}
              />
            ) : null
          }
          title="Financeiro"
        />

        <FinancialTabs
          analysis={
            analysisData ? (
              <FinancialAnalysis analytics={analysisData.analytics} />
            ) : null
          }
          orders={
            ordersData ? (
              <section
                aria-labelledby="financial-orders-title"
                className="grid gap-6"
              >
                <div>
                  <h2
                    className="type-section-title"
                    id="financial-orders-title"
                  >
                    Pedidos
                  </h2>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Busque, filtre e abra um pedido para consultar detalhes e
                    ações.
                  </p>
                </div>
                <FinancialOrdersTable
                  canExecuteRefund={canExecuteRefund}
                  canManageFinancialOperations={canManageFinancialOperations}
                  checkout={orderCheckout}
                  hasNextPage={ordersData.ordersHasNextPage}
                  orders={ordersData.orders}
                  page={orderPage}
                  paymentEvidence={orderPaymentEvidence}
                  paymentMethod={orderPaymentMethod}
                  refundStatus={orderRefundStatus}
                  search={orderSearch}
                  status={orderStatus}
                  totalCount={ordersData.ordersTotalCount}
                />
              </section>
            ) : null
          }
          overview={
            overviewData ? (
              <FinancialOverview
                canExecuteRefund={canExecuteRefund}
                canManageFinancialOperations={canManageFinancialOperations}
                canManageFinancialReviews={canManageFinancialReviews}
                canViewOperations={canViewOperations}
                coursesRevenue={overviewData.coursesRevenue}
                financialHealth={overviewData.financialHealth}
                paymentReviews={overviewData.paymentReviews}
              />
            ) : null
          }
          visibleTabs={visibleTabs}
        />
      </div>
    </PageContainer>
  );
}
