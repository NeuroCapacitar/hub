import type { PoolClient } from "pg";
import { withVerifiedSslMode } from "@/db/connection-url";
import {
  enqueuePurchaseConfirmedEmail,
  type PurchaseConfirmationEnqueueResult,
} from "@/features/payments/purchase-confirmation";

type Environment = Readonly<Record<string, string | undefined>>;
type CutoverMode = "dry-run" | "execute";
type CutoverEnvironment = "development" | "production" | "staging";

const EXECUTE_CONFIRMATION = "REPLACE_UNACCEPTED_PURCHASE_CONFIRMATION_V1";
const BATCH_LIMIT = 100;
const TRAILING_DOT_PATTERN = /\.$/;
const POSSIBLY_ACCEPTED_EMAIL_STATES = [
  "acceptance_unknown",
  "accepted",
  "bounced",
  "complained",
  "delayed",
  "delivered",
  "sending",
  "suppressed",
] as const;

export interface PurchaseConfirmationCutoverTarget {
  databaseUrl: string;
  environment: CutoverEnvironment;
  mode: CutoverMode;
}

export interface PurchaseConfirmationCutoverResult {
  alreadyRegistered: number;
  ambiguousLegacy: number;
  eligible: number;
  enqueued: number;
  inFlightLegacy: number;
  processed: number;
  remaining: number;
  schemaReady: true;
}

export type ReplaceLegacyPurchaseEmail = (input: {
  client: PoolClient;
  orderId: string;
  replaceHistorical: true;
  userId: string;
}) => Promise<PurchaseConfirmationEnqueueResult>;

interface CutoverCounts {
  ambiguous: number;
  eligible: number;
  in_flight: number;
  total: number;
}

interface HistoricalPurchaseOrderRow {
  order_id: string;
  user_id: string;
}

const readRequiredEnvironment = (
  environment: Environment,
  name: string
): string => {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
};

const normalizeHost = (host: string): string =>
  host.trim().toLowerCase().replace(TRAILING_DOT_PATTERN, "");

const parseCutoverArguments = (
  argv: readonly string[]
): { environment: CutoverEnvironment; mode: CutoverMode } => {
  const environmentArgs = argv.filter((value) =>
    value.startsWith("--environment=")
  );
  const modeArgs = argv.filter(
    (value) => value === "--dry-run" || value === "--execute"
  );
  if (
    environmentArgs.length !== 1 ||
    modeArgs.length !== 1 ||
    argv.length !== 2
  ) {
    throw new Error(
      "Use exactly --environment=development|staging|production and --dry-run|--execute."
    );
  }

  const environment = environmentArgs[0]?.slice("--environment=".length);
  if (
    environment !== "development" &&
    environment !== "staging" &&
    environment !== "production"
  ) {
    throw new Error("Purchase confirmation cutover environment is invalid.");
  }
  return {
    environment,
    mode: modeArgs[0] === "--execute" ? "execute" : "dry-run",
  };
};

export const resolvePurchaseConfirmationCutoverTarget = ({
  argv,
  environment,
}: {
  argv: readonly string[];
  environment: Environment;
}): PurchaseConfirmationCutoverTarget => {
  const target = parseCutoverArguments(argv);
  if (
    target.mode === "execute" &&
    environment.PURCHASE_CONFIRMATION_CUTOVER_CONFIRMATION !==
      EXECUTE_CONFIRMATION
  ) {
    throw new Error(
      `PURCHASE_CONFIRMATION_CUTOVER_CONFIRMATION must equal ${EXECUTE_CONFIRMATION}.`
    );
  }
  if (
    target.mode === "execute" &&
    environment.PURCHASE_CONFIRMED_TEMPLATE_PUBLISHED !== "true"
  ) {
    throw new Error(
      "PURCHASE_CONFIRMED_TEMPLATE_PUBLISHED must be true before execution."
    );
  }

  const databaseUrl = readRequiredEnvironment(
    environment,
    "DATABASE_URL_DIRECT"
  );
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL_DIRECT is invalid.");
  }
  if (
    !["postgres:", "postgresql:"].includes(parsedUrl.protocol) ||
    parsedUrl.searchParams.get("sslmode") !== "verify-full" ||
    normalizeHost(parsedUrl.hostname).includes("-pooler")
  ) {
    throw new Error(
      "DATABASE_URL_DIRECT must be a verified direct PostgreSQL URL."
    );
  }

  let hostVariable = "DEVELOPMENT_DATABASE_HOST";
  if (target.environment === "production") {
    hostVariable = "PRODUCTION_DATABASE_HOST";
  } else if (target.environment === "staging") {
    hostVariable = "STAGING_DATABASE_HOST";
  }
  if (
    normalizeHost(parsedUrl.hostname) !==
    normalizeHost(readRequiredEnvironment(environment, hostVariable))
  ) {
    throw new Error(
      "DATABASE_URL_DIRECT does not match the declared environment."
    );
  }

  return { ...target, databaseUrl: withVerifiedSslMode(databaseUrl) };
};

const assertPurchaseConfirmationSchema = async (
  client: Pick<PoolClient, "query">
): Promise<void> => {
  const result = await client.query<{ schema_ready: boolean }>(`
    select (
      to_regclass('public.purchase_confirmation_intents') is not null
      and to_regclass('public.account_email_challenges') is not null
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'purchase_confirmation_intents'
          and column_name = 'verification_required'
      )
      and exists (
        select 1 from pg_enum value
        join pg_type type on type.oid = value.enumtypid
        where type.typname = 'email_delivery_topic'
          and value.enumlabel = 'email.purchase-confirmed'
      )
      and exists (
        select 1 from pg_enum value
        join pg_type type on type.oid = value.enumtypid
        where type.typname = 'account_email_challenge_purpose'
          and value.enumlabel = 'purchase_verification'
      )
    ) as schema_ready
  `);
  if (!result.rows[0]?.schema_ready) {
    throw new Error("Migrations 0098 and 0101 are not applied to the target.");
  }
};

export const getPurchaseConfirmationCutoverCounts = async (
  client: Pick<PoolClient, "query">
): Promise<CutoverCounts> => {
  const result = await client.query<CutoverCounts>(
    `
      with legacy_messages as (
        select
          orders.id as order_id,
          message.status as outbox_status,
          email_messages.status as email_status
        from orders
        left join purchase_confirmation_intents as intent
          on intent.order_id = orders.id
        join outbox_messages as message
          on message.aggregate_type = 'order'
          and message.aggregate_id = orders.id::text
          and message.topic in ('auth.account-activation', 'email.access-released')
          and message.status in ('pending', 'retrying', 'dead_letter', 'processing')
        left join email_messages
          on email_messages.outbox_message_id = message.id
        where (intent.order_id is null or intent.origin = 'historical')
          and orders.status = 'paid'
          and orders.buyer_identity_status = 'resolved'
          and orders.user_id is not null
      ), per_order as (
        select
          order_id,
          bool_or(outbox_status = 'processing') as in_flight,
          bool_or(
            outbox_status = 'processing'
            or coalesce(
              email_status = any($1::email_message_status[]),
              false
            )
          ) as ambiguous,
          bool_or(
            outbox_status in ('pending', 'retrying', 'dead_letter')
            and (email_status is null or email_status = 'failed')
          ) as replaceable
        from legacy_messages
        group by order_id
      )
      select
        count(*)::int as total,
        count(*) filter (where replaceable and not ambiguous)::int as eligible,
        count(*) filter (where ambiguous)::int as ambiguous,
        count(*) filter (where in_flight)::int as in_flight
      from per_order
    `,
    [POSSIBLY_ACCEPTED_EMAIL_STATES]
  );
  return (
    result.rows[0] ?? { ambiguous: 0, eligible: 0, in_flight: 0, total: 0 }
  );
};

export const getPurchaseConfirmationLegacyCutoverCandidates = async (
  client: Pick<PoolClient, "query">
): Promise<HistoricalPurchaseOrderRow[]> => {
  const result = await client.query<HistoricalPurchaseOrderRow>(
    `
      with candidates as (
        select orders.id, orders.user_id
        from orders
        left join purchase_confirmation_intents as intent
          on intent.order_id = orders.id
        where (intent.order_id is null or intent.origin = 'historical')
          and orders.status = 'paid'
          and orders.buyer_identity_status = 'resolved'
          and orders.user_id is not null
          and exists (
            select 1
            from outbox_messages as message
            where message.aggregate_type = 'order'
              and message.aggregate_id = orders.id::text
              and message.topic in ('auth.account-activation', 'email.access-released')
              and message.status in ('pending', 'retrying', 'dead_letter')
          )
        order by orders.id
        limit $1
      )
      select candidates.id::text as order_id, candidates.user_id
      from candidates
      join orders on orders.id = candidates.id
      order by candidates.id
      for update of orders
    `,
    [BATCH_LIMIT]
  );
  return result.rows;
};

export const runPurchaseConfirmationLegacyCutover = async ({
  client,
  mode,
  replaceLegacy = enqueuePurchaseConfirmedEmail,
}: {
  client: PoolClient;
  mode: CutoverMode;
  replaceLegacy?: ReplaceLegacyPurchaseEmail;
}): Promise<PurchaseConfirmationCutoverResult> => {
  let transactionOpen = false;
  try {
    await client.query(
      mode === "dry-run"
        ? "begin isolation level repeatable read read only"
        : "begin isolation level serializable"
    );
    transactionOpen = true;
    await client.query("set local statement_timeout = '5min'");
    await client.query("set local lock_timeout = '10s'");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended('purchase-confirmation-v1-cutover', 0))"
    );
    await assertPurchaseConfirmationSchema(client);
    const counts = await getPurchaseConfirmationCutoverCounts(client);
    if (mode === "dry-run") {
      await client.query("rollback");
      transactionOpen = false;
      return {
        alreadyRegistered: 0,
        ambiguousLegacy: counts.ambiguous,
        enqueued: 0,
        eligible: counts.eligible,
        inFlightLegacy: counts.in_flight,
        processed: 0,
        remaining: counts.total,
        schemaReady: true,
      };
    }

    const candidates =
      await getPurchaseConfirmationLegacyCutoverCandidates(client);
    let enqueued = 0;
    let ambiguousLegacy = 0;
    let alreadyRegistered = 0;
    for (const candidate of candidates) {
      const outcome = await replaceLegacy({
        client,
        orderId: candidate.order_id,
        replaceHistorical: true,
        userId: candidate.user_id,
      });
      if (outcome === "enqueued") {
        enqueued += 1;
      } else if (outcome === "legacy_satisfied") {
        ambiguousLegacy += 1;
      } else {
        alreadyRegistered += 1;
      }
    }

    const remaining = await getPurchaseConfirmationCutoverCounts(client);
    await client.query("commit");
    transactionOpen = false;
    return {
      alreadyRegistered,
      ambiguousLegacy,
      enqueued,
      eligible: counts.eligible,
      inFlightLegacy: remaining.in_flight,
      processed: candidates.length,
      remaining: remaining.total,
      schemaReady: true,
    };
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query("rollback");
      } catch {
        // Preserve the original sanitized failure.
      }
    }
    throw error;
  }
};
