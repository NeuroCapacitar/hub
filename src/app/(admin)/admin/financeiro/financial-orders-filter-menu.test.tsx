import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  FinancialOrdersFilterMenu,
  getCheckoutFilterHref,
  getOrdersFilterHref,
  getOrdersFilterMenuHref,
} from "./financial-orders-filter-menu";

describe("FinancialOrdersFilterMenu", () => {
  it("shows active filters as removable pills without duplicating controls", () => {
    const markup = renderToStaticMarkup(
      <FinancialOrdersFilterMenu
        paymentMethod="CREDIT_CARD"
        search="Student"
        status="paid"
      />
    );

    expect(markup).toContain("Filtros");
    expect(markup).toContain("Status: Pago");
    expect(markup).toContain("Pagamento: Cartão de crédito");
    expect(markup).toContain("Remover filtro Status: Pago");
    expect(markup).toContain("Remover filtro Pagamento: Cartão de crédito");
    expect(markup).toContain("tab=orders");
    expect(markup).toContain("status=paid");
    expect(markup).toContain("paymentMethod=CREDIT_CARD");
  });

  it("represents search as active state and clears it from filter URLs", () => {
    const markup = renderToStaticMarkup(
      <FinancialOrdersFilterMenu
        paymentMethod="CREDIT_CARD"
        search="Student"
        status="paid"
      />
    );
    const hrefs = [...markup.matchAll(/href="([^"]+)"/g)].map((match) =>
      (match[1] ?? "").replaceAll("&amp;", "&")
    );

    expect(markup).toContain("Busca: Student");
    expect(markup).toContain("Remover filtro Busca: Student");
    expect(hrefs).toContain(
      "/admin/financeiro?tab=orders&status=paid&paymentMethod=CREDIT_CARD"
    );
    expect(hrefs).toContain(
      "/admin/financeiro?tab=orders&q=Student&status=paid"
    );
    expect(hrefs).toContain(
      "/admin/financeiro?tab=orders&q=Student&paymentMethod=CREDIT_CARD"
    );
    expect(
      getOrdersFilterHref({
        paymentMethod: undefined,
        search: "",
        status: undefined,
      })
    ).toBe("/admin/financeiro?tab=orders");
  });

  it("keeps the filter trigger quiet when no filter is active", () => {
    const markup = renderToStaticMarkup(
      <FinancialOrdersFilterMenu search="" />
    );

    expect(markup).toContain("Filtros");
    expect(markup).not.toContain("Status:");
    expect(markup).not.toContain("Pagamento:");
  });

  it("keeps checkout state visible and encoded with the other filters", () => {
    const markup = renderToStaticMarkup(
      <FinancialOrdersFilterMenu
        checkout="open"
        paymentMethod="PIX"
        search=""
        status="pending"
      />
    );

    expect(markup).toContain("Checkout: Em aberto");
    expect(markup).toContain("checkout=open");
    expect(markup).toContain("status=pending");
    expect(markup).toContain("paymentMethod=PIX");
    expect(markup).toContain("Remover filtro Checkout: Em aberto");
  });

  it("does not narrow the closed checkout filter to pending orders", () => {
    const href = getCheckoutFilterHref({
      checkout: "closed",
      paymentMethod: "PIX",
      refundStatus: "failed",
      search: "Student",
    });

    expect(href).toBe(
      "/admin/financeiro?tab=orders&checkout=closed&q=Student&paymentMethod=PIX&refundStatus=failed"
    );
    expect(href).not.toContain("status=pending");
  });

  it("encodes payment-correlation filters with the orders tab", () => {
    expect(
      getOrdersFilterHref({
        paymentEvidence: "uncorrelated",
        search: "",
        status: "paid",
      })
    ).toBe(
      "/admin/financeiro?tab=orders&status=paid&paymentEvidence=uncorrelated"
    );
  });

  it("keeps payment evidence only with paid orders and no checkout filter", () => {
    const currentFilters = {
      paymentEvidence: "uncorrelated" as const,
      search: "student",
    };

    expect(
      getOrdersFilterMenuHref(
        { checkout: "open", status: "pending" },
        currentFilters
      )
    ).toBe(
      "/admin/financeiro?tab=orders&checkout=open&q=student&status=pending"
    );
    expect(
      getOrdersFilterMenuHref({ status: "refunded" }, currentFilters)
    ).toBe("/admin/financeiro?tab=orders&q=student&status=refunded");
    expect(getOrdersFilterMenuHref({ status: "paid" }, currentFilters)).toBe(
      "/admin/financeiro?tab=orders&q=student&status=paid&paymentEvidence=uncorrelated"
    );
  });

  it("uses the payment-evidence option label in the active filter", () => {
    const markup = renderToStaticMarkup(
      <FinancialOrdersFilterMenu
        paymentEvidence="uncorrelated"
        search=""
        status="paid"
      />
    );

    expect(markup).toContain("Vínculo: Pagamento sem vínculo");
  });

  it("shows the refund state as a removable filter", () => {
    const markup = renderToStaticMarkup(
      <FinancialOrdersFilterMenu refundStatus="failed" search="" />
    );

    expect(markup).toContain("Reembolso: Falhou");
    expect(markup).toContain("Remover filtro Reembolso: Falhou");
    expect(
      getOrdersFilterHref({ refundStatus: "failed", search: "" })
    ).toContain("refundStatus=failed");
  });
});
