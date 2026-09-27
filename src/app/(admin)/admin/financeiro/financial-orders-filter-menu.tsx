import { Cancel01Icon, FilterIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ADMIN_ORDER_CHECKOUT_FILTERS,
  ADMIN_ORDER_PAYMENT_EVIDENCE_FILTERS,
  ADMIN_ORDER_PAYMENT_METHOD_FILTERS,
  ADMIN_ORDER_REFUND_FILTERS,
  ADMIN_ORDER_STATUS_FILTERS,
  type AdminOrderCheckoutFilter,
  type AdminOrderPaymentEvidenceFilter,
  type AdminOrderPaymentMethodFilter,
  type AdminOrderRefundFilter,
  type AdminOrderStatusFilter,
  getAdminOrderCheckoutFilterLabel,
  getAdminOrderPaymentMethodFilterLabel,
  getAdminOrderRefundFilterLabel,
  getAdminOrderStatusFilterLabel,
} from "@/features/admin/order-filters";
import { route } from "@/lib/routes";

interface OrdersFilterHrefOptions {
  checkout?: AdminOrderCheckoutFilter | undefined;
  paymentEvidence?: AdminOrderPaymentEvidenceFilter | undefined;
  paymentMethod?: AdminOrderPaymentMethodFilter | undefined;
  refundStatus?: AdminOrderRefundFilter | undefined;
  search: string;
  status?: AdminOrderStatusFilter | undefined;
}

export const getOrdersFilterHref = ({
  checkout,
  paymentEvidence,
  paymentMethod,
  refundStatus,
  search,
  status,
}: OrdersFilterHrefOptions): string => {
  const params = new URLSearchParams({ tab: "orders" });
  if (checkout) {
    params.set("checkout", checkout);
  }
  if (search) {
    params.set("q", search);
  }
  if (status) {
    params.set("status", status);
  }
  if (paymentMethod) {
    params.set("paymentMethod", paymentMethod);
  }
  if (paymentEvidence) {
    params.set("paymentEvidence", paymentEvidence);
  }
  if (refundStatus) {
    params.set("refundStatus", refundStatus);
  }
  return route(`/admin/financeiro?${params.toString()}`);
};

type OrdersFilterMenuHrefOptions = Partial<
  Pick<
    OrdersFilterHrefOptions,
    | "checkout"
    | "paymentEvidence"
    | "paymentMethod"
    | "refundStatus"
    | "search"
    | "status"
  >
>;

export const getOrdersFilterMenuHref = (
  options: OrdersFilterMenuHrefOptions,
  currentFilters: Pick<OrdersFilterHrefOptions, "paymentEvidence" | "search">
): string => {
  const requestedPaymentEvidence =
    "paymentEvidence" in options
      ? options.paymentEvidence
      : currentFilters.paymentEvidence;
  const paymentEvidence =
    options.status === "paid" && !options.checkout
      ? requestedPaymentEvidence
      : undefined;

  return getOrdersFilterHref({
    checkout: options.checkout,
    paymentEvidence,
    paymentMethod: options.paymentMethod,
    refundStatus: options.refundStatus,
    search: options.search ?? currentFilters.search,
    status: options.status,
  });
};

export const getCheckoutFilterHref = ({
  checkout,
  paymentMethod,
  refundStatus,
  search,
}: Omit<OrdersFilterHrefOptions, "checkout" | "paymentEvidence" | "status"> & {
  checkout: AdminOrderCheckoutFilter;
}): string =>
  getOrdersFilterHref({
    checkout,
    paymentMethod,
    refundStatus,
    search,
    status: checkout === "closed" ? undefined : "pending",
  });

function FilterMenuLink({
  active,
  children,
  href,
}: {
  active: boolean;
  children: React.ReactNode;
  href: string;
}): React.JSX.Element {
  return (
    <DropdownMenuItem asChild>
      <Link
        aria-current={active ? "true" : undefined}
        className="flex w-full items-center"
        href={href}
      >
        {children}
        {active ? (
          <Badge className="ml-auto" variant="outline">
            Atual
          </Badge>
        ) : null}
      </Link>
    </DropdownMenuItem>
  );
}

function ActiveFilterPill({
  label,
  onRemoveHref,
}: {
  label: string;
  onRemoveHref: string;
}): React.JSX.Element {
  return (
    <Badge
      asChild
      className="min-h-9 max-w-full cursor-pointer px-2.5 py-1"
      variant="secondary"
    >
      <Link
        aria-label={`Remover filtro ${label}`}
        className="flex min-h-9 max-w-full items-center gap-1.5"
        href={onRemoveHref}
        title={`Remover filtro ${label}`}
      >
        <span className="truncate">{label}</span>
        <HugeiconsIcon
          aria-hidden="true"
          icon={Cancel01Icon}
          size={14}
          strokeWidth={2}
        />
      </Link>
    </Badge>
  );
}

export function FinancialOrdersFilterMenu({
  checkout,
  paymentEvidence,
  paymentMethod,
  refundStatus,
  search,
  status,
}: {
  checkout?: AdminOrderCheckoutFilter | undefined;
  paymentEvidence?: AdminOrderPaymentEvidenceFilter | undefined;
  paymentMethod?: AdminOrderPaymentMethodFilter | undefined;
  refundStatus?: AdminOrderRefundFilter | undefined;
  search: string;
  status?: AdminOrderStatusFilter | undefined;
}): React.JSX.Element {
  const activeFilterCount =
    Number(Boolean(search)) +
    Number(Boolean(status)) +
    Number(Boolean(paymentEvidence)) +
    Number(Boolean(paymentMethod)) +
    Number(Boolean(checkout)) +
    Number(Boolean(refundStatus));
  const paymentEvidenceLabel = paymentEvidence
    ? (ADMIN_ORDER_PAYMENT_EVIDENCE_FILTERS.find(
        (option) => option.value === paymentEvidence
      )?.label ?? paymentEvidence)
    : undefined;
  const baseHref = (options: OrdersFilterMenuHrefOptions = {}) =>
    getOrdersFilterMenuHref(options, { paymentEvidence, search });

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Abrir filtros de pedidos"
            size="sm"
            type="button"
            variant="outline"
          >
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={FilterIcon}
              size={16}
              strokeWidth={2}
            />
            Filtros
            {activeFilterCount > 0 ? (
              <Badge variant="secondary">{activeFilterCount}</Badge>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Filtrar pedidos por</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                Estado do checkout
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuGroup>
                  <FilterMenuLink
                    active={!checkout}
                    href={baseHref({
                      checkout: undefined,
                      paymentMethod,
                      refundStatus,
                      status,
                    })}
                  >
                    Todos
                  </FilterMenuLink>
                  {ADMIN_ORDER_CHECKOUT_FILTERS.map((option) => (
                    <FilterMenuLink
                      active={checkout === option.value}
                      href={getCheckoutFilterHref({
                        checkout: option.value,
                        paymentMethod,
                        refundStatus,
                        search,
                      })}
                      key={option.value}
                    >
                      {option.label}
                    </FilterMenuLink>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                Vínculo do pagamento
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuGroup>
                  <FilterMenuLink
                    active={!paymentEvidence}
                    href={baseHref({
                      checkout,
                      paymentEvidence: undefined,
                      paymentMethod,
                      refundStatus,
                      status,
                    })}
                  >
                    Todos
                  </FilterMenuLink>
                  {ADMIN_ORDER_PAYMENT_EVIDENCE_FILTERS.map((option) => (
                    <FilterMenuLink
                      active={paymentEvidence === option.value}
                      href={baseHref({
                        checkout: undefined,
                        paymentEvidence: option.value,
                        paymentMethod,
                        refundStatus,
                        status: "paid",
                      })}
                      key={option.value}
                    >
                      {option.label}
                    </FilterMenuLink>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Tipo de pagamento</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuGroup>
                  <FilterMenuLink
                    active={!paymentMethod}
                    href={baseHref({ checkout, refundStatus, status })}
                  >
                    Todos
                  </FilterMenuLink>
                  {ADMIN_ORDER_PAYMENT_METHOD_FILTERS.map((option) => (
                    <FilterMenuLink
                      active={paymentMethod === option.value}
                      href={baseHref({
                        checkout,
                        paymentMethod: option.value,
                        refundStatus,
                        status,
                      })}
                      key={option.value}
                    >
                      {option.label}
                    </FilterMenuLink>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Status do pedido</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuGroup>
                  <FilterMenuLink
                    active={!status}
                    href={baseHref({ checkout, paymentMethod, refundStatus })}
                  >
                    Todos
                  </FilterMenuLink>
                  {ADMIN_ORDER_STATUS_FILTERS.map((option) => (
                    <FilterMenuLink
                      active={status === option}
                      href={baseHref({
                        checkout: option === "pending" ? checkout : undefined,
                        paymentMethod,
                        refundStatus,
                        status: option,
                      })}
                      key={option}
                    >
                      {getAdminOrderStatusFilterLabel(option)}
                    </FilterMenuLink>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                Estado do reembolso
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuGroup>
                  <FilterMenuLink
                    active={!refundStatus}
                    href={baseHref({
                      checkout,
                      paymentMethod,
                      refundStatus: undefined,
                      status,
                    })}
                  >
                    Todos
                  </FilterMenuLink>
                  {ADMIN_ORDER_REFUND_FILTERS.map((option) => (
                    <FilterMenuLink
                      active={refundStatus === option.value}
                      href={baseHref({
                        checkout,
                        paymentMethod,
                        refundStatus: option.value,
                        status,
                      })}
                      key={option.value}
                    >
                      {option.label}
                    </FilterMenuLink>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          {activeFilterCount > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild variant="destructive">
                  <Link
                    href={baseHref({
                      checkout: undefined,
                      paymentEvidence: undefined,
                      paymentMethod: undefined,
                      refundStatus: undefined,
                      search: "",
                      status: undefined,
                    })}
                  >
                    Limpar filtros
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {status ? (
        <ActiveFilterPill
          label={`Status: ${getAdminOrderStatusFilterLabel(status)}`}
          onRemoveHref={baseHref({ checkout, paymentMethod, refundStatus })}
        />
      ) : null}
      {checkout ? (
        <ActiveFilterPill
          label={`Checkout: ${getAdminOrderCheckoutFilterLabel(checkout)}`}
          onRemoveHref={baseHref({
            checkout: undefined,
            paymentMethod,
            refundStatus,
            status,
          })}
        />
      ) : null}
      {paymentMethod ? (
        <ActiveFilterPill
          label={`Pagamento: ${getAdminOrderPaymentMethodFilterLabel(paymentMethod)}`}
          onRemoveHref={baseHref({ checkout, refundStatus, status })}
        />
      ) : null}
      {refundStatus ? (
        <ActiveFilterPill
          label={`Reembolso: ${getAdminOrderRefundFilterLabel(refundStatus)}`}
          onRemoveHref={baseHref({ checkout, paymentMethod, status })}
        />
      ) : null}
      {paymentEvidence ? (
        <ActiveFilterPill
          label={`Vínculo: ${paymentEvidenceLabel}`}
          onRemoveHref={baseHref({
            checkout,
            paymentEvidence: undefined,
            paymentMethod,
            refundStatus,
            status,
          })}
        />
      ) : null}
      {search ? (
        <ActiveFilterPill
          label={`Busca: ${search}`}
          onRemoveHref={baseHref({
            checkout,
            paymentMethod,
            refundStatus,
            search: "",
            status,
          })}
        />
      ) : null}
    </div>
  );
}
