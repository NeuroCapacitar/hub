import { describe, expect, it } from "vitest";
import { getAdminFinancialOrderQuery } from "./financial-order-query";

describe("getAdminFinancialOrderQuery", () => {
  it("keeps both pending and cancelled orders in the closed checkout view", () => {
    expect(getAdminFinancialOrderQuery({ checkout: "closed" })).toMatchObject({
      checkout: "closed",
      status: undefined,
    });
    expect(
      getAdminFinancialOrderQuery({ checkout: "closed", status: "cancelled" })
    ).toMatchObject({ checkout: "closed", status: "cancelled" });
  });

  it("keeps checkout-paid sessions separate from active checkout potential", () => {
    expect(
      getAdminFinancialOrderQuery({
        checkout: "paid-awaiting-confirmation",
        status: "pending",
      })
    ).toMatchObject({
      checkout: "paid-awaiting-confirmation",
      status: "pending",
    });
  });

  it("accepts only known refund filters", () => {
    expect(
      getAdminFinancialOrderQuery({ refundStatus: "failed" }).refundStatus
    ).toBe("failed");
    expect(
      getAdminFinancialOrderQuery({ refundStatus: "unexpected" }).refundStatus
    ).toBeUndefined();
  });

  it("routes uncertain checkouts separately from ordinary open attempts", () => {
    expect(
      getAdminFinancialOrderQuery({ checkout: "uncertain", status: "pending" })
    ).toMatchObject({ checkout: "uncertain", status: "pending" });
  });

  it("accepts the payment-correlation action queue filter", () => {
    expect(
      getAdminFinancialOrderQuery({
        paymentEvidence: "uncorrelated",
        status: "paid",
      })
    ).toMatchObject({ paymentEvidence: "uncorrelated", status: "paid" });
    expect(
      getAdminFinancialOrderQuery({ paymentEvidence: "unknown" })
        .paymentEvidence
    ).toBeUndefined();
  });
});
