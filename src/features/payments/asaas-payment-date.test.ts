import { describe, expect, it } from "vitest";
import { getAsaasPaymentDate } from "./asaas-payment-date";

describe("getAsaasPaymentDate", () => {
  it("prefers the date the customer paid when the provider supplies it", () => {
    expect(
      getAsaasPaymentDate({
        confirmedDate: "2026-09-25",
        customerPaymentDate: "2026-09-24",
        paymentDate: "2026-09-23",
      })
    ).toBe("2026-09-24");
  });

  it("uses a valid fallback field when the preferred date is malformed", () => {
    expect(
      getAsaasPaymentDate({
        customerPaymentDate: "2026-02-30",
        paymentDate: "2026-02-28",
      })
    ).toBe("2026-02-28");
  });

  it("does not invent a date when provider evidence is invalid or absent", () => {
    expect(
      getAsaasPaymentDate({
        confirmedDate: "2026-13-01",
        paymentDate: "not-a-date",
      })
    ).toBeUndefined();
  });
});
