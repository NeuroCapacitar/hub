interface AsaasPaymentDateFields {
  clientPaymentDate?: string | null;
  confirmedDate?: string | null;
  customerPaymentDate?: string | null;
  paymentDate?: string | null;
}

const PROVIDER_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidProviderDate = (
  value: string | null | undefined
): value is string => {
  if (!(value && PROVIDER_DATE_PATTERN.test(value))) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};

export const getAsaasPaymentDate = (
  payment: AsaasPaymentDateFields
): string | undefined => {
  const candidates = [
    payment.customerPaymentDate,
    payment.clientPaymentDate,
    payment.paymentDate,
    payment.confirmedDate,
  ];

  return candidates.find(isValidProviderDate);
};
