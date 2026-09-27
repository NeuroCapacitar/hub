import { APP_TIME_ZONE } from "@/lib/timezone";

export const getConfirmedSalePredicate = (tableAlias: string): string => {
  const prefix = tableAlias ? `${tableAlias}.` : "";
  return `${prefix}status in ('paid', 'refunded', 'disputed')
    and ${prefix}paid_at is not null
    and ${prefix}paid_amount_in_cents is not null
    and (${prefix}provider_payment_id is not null or ${prefix}provider_installment_id is not null)`;
};

export const getSaleDateExpression = (tableAlias: string): string => {
  const prefix = tableAlias ? `${tableAlias}.` : "";
  return `coalesce(
    ${prefix}provider_payment_date::timestamp at time zone '${APP_TIME_ZONE}',
    ${prefix}paid_at
  )`;
};

export const getActiveCheckoutPredicate = (tableAlias: string): string => {
  const prefix = tableAlias ? `${tableAlias}.` : "";
  return `${prefix}status = 'pending' and ${prefix}checkout_status = 'active' and ${prefix}provider_checkout_id is not null and ${prefix}checkout_url is not null and ${prefix}provider_payment_id is null and ${prefix}provider_payment_status is null and upper(${prefix}provider_checkout_status) is distinct from 'PAID'`;
};

export interface FinancialAnalyticsQueryInput {
  fromDate: Date | null;
  periodEnd: Date;
}

export interface FinancialAnalyticsQuery {
  text: string;
  values: [Date | null, Date];
}

export const buildFinancialAnalyticsQuery = ({
  fromDate,
  periodEnd,
}: FinancialAnalyticsQueryInput): FinancialAnalyticsQuery => ({
  text: `
    with received_orders as (
      select
        count(*) filter (
          where ${getConfirmedSalePredicate("")}
            and ($1::timestamptz is null or ${getSaleDateExpression("")} >= $1::timestamptz)
            and ${getSaleDateExpression("")} <= $2::timestamptz
        )::int as confirmed_sale_orders,
        coalesce(sum(paid_amount_in_cents) filter (
          where ${getConfirmedSalePredicate("")}
            and ($1::timestamptz is null or ${getSaleDateExpression("")} >= $1::timestamptz)
            and ${getSaleDateExpression("")} <= $2::timestamptz
        ), 0)::bigint as gross_confirmed_sales_in_cents,
        coalesce(sum(coalesce(fee_amount_in_cents, 0)) filter (
          where ${getConfirmedSalePredicate("")}
            and ($1::timestamptz is null or ${getSaleDateExpression("")} >= $1::timestamptz)
            and ${getSaleDateExpression("")} <= $2::timestamptz
        ), 0)::bigint as fees_in_cents,
        count(*) filter (
          where ${getConfirmedSalePredicate("")}
            and ($1::timestamptz is null or ${getSaleDateExpression("")} >= $1::timestamptz)
            and ${getSaleDateExpression("")} <= $2::timestamptz
            and (fee_amount_in_cents is null or net_amount_in_cents is null)
        )::int as missing_fee_evidence_orders,
        count(*) filter (
          where ${getConfirmedSalePredicate("")}
            and ($1::timestamptz is null or ${getSaleDateExpression("")} >= $1::timestamptz)
            and ${getSaleDateExpression("")} <= $2::timestamptz
            and provider_payment_date is null
        )::int as provider_payment_date_fallback_orders,
        count(*) filter (
          where ${getActiveCheckoutPredicate("")}
            and ($1::timestamptz is null or created_at >= $1::timestamptz)
            and created_at <= $2::timestamptz
        )::int as active_checkout_count,
        coalesce(sum(amount_in_cents) filter (
          where ${getActiveCheckoutPredicate("")}
            and ($1::timestamptz is null or created_at >= $1::timestamptz)
            and created_at <= $2::timestamptz
        ), 0)::bigint as active_checkout_potential_in_cents,
        (select count(distinct order_id)::int
         from payment_reviews review
         where review.status = 'pending'
           and review.type = 'partial_refund'
           and ($1::timestamptz is null or review.created_at >= $1::timestamptz)
           and review.created_at <= $2::timestamptz)
          as pending_partial_refund_review_count
      from orders
    ),
    refunds as (
      select
        count(*) filter (
          where (
            rr.status = 'confirmed'
            or o.status = 'refunded'
          )
            and ($1::timestamptz is null or coalesce(rr.confirmed_at, o.refunded_at) >= $1::timestamptz)
            and coalesce(rr.confirmed_at, o.refunded_at) <= $2::timestamptz
        )::int as refunded_orders,
        coalesce(sum(
          case
            when rr.status = 'confirmed' then coalesce(
              rr.provider_refunded_amount_in_cents,
              coalesce(o.paid_amount_in_cents, o.amount_in_cents)
            )
            when o.status = 'refunded' then
              coalesce(o.paid_amount_in_cents, o.amount_in_cents)
            else 0
          end
        ) filter (
          where (
            rr.status = 'confirmed'
            or o.status = 'refunded'
          )
            and ($1::timestamptz is null or coalesce(rr.confirmed_at, o.refunded_at) >= $1::timestamptz)
            and coalesce(rr.confirmed_at, o.refunded_at) <= $2::timestamptz
        ), 0)::bigint as refunded_revenue_in_cents
      from orders o
      left join refund_requests rr on rr.order_id = o.id
    )
    select received_orders.*, refunds.*
    from received_orders cross join refunds
  `,
  values: [fromDate, periodEnd],
});
