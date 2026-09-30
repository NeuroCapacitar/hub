import "server-only";
import type { PoolClient } from "pg";
import { createPurchaseConfirmedMessage } from "@/features/outbox/rules";
import { enqueueOutboxMessage } from "@/features/outbox/server";

const LEGACY_PURCHASE_EMAIL_TOPICS = [
  "auth.account-activation",
  "email.access-released",
] as const;

const POSSIBLY_ACCEPTED_EMAIL_STATES = new Set([
  "acceptance_unknown",
  "accepted",
  "bounced",
  "complained",
  "delayed",
  "delivered",
  "sending",
  "suppressed",
]);

const REPLACEABLE_OUTBOX_STATES = new Set([
  "dead_letter",
  "pending",
  "retrying",
]);

interface PurchaseConfirmationLedgerRow {
  origin: "current" | "historical";
}

interface LegacyPurchaseEmailRow {
  email_status: string | null;
  id: string;
  status: string;
  topic: (typeof LEGACY_PURCHASE_EMAIL_TOPICS)[number];
}

interface PurchaseVerificationChallengeRow {
  consumed_at: Date | null;
  expires_at: Date;
  generation: number;
  id: string;
  purpose: string;
  user_id: string;
}

export type PurchaseConfirmationEnqueueResult =
  | "already_registered"
  | "enqueued"
  | "legacy_satisfied";

const hasPotentiallyAcceptedLegacyEmail = (
  legacyMessages: readonly LegacyPurchaseEmailRow[]
): boolean =>
  legacyMessages.some(
    (message) =>
      message.status === "processing" ||
      message.status === "delivered" ||
      (message.email_status !== null &&
        POSSIBLY_ACCEPTED_EMAIL_STATES.has(message.email_status))
  );

const supersedeUnacceptedLegacyMessages = async ({
  client,
  messages,
}: {
  client: PoolClient;
  messages: readonly LegacyPurchaseEmailRow[];
}): Promise<void> => {
  for (const message of messages) {
    if (!REPLACEABLE_OUTBOX_STATES.has(message.status)) {
      continue;
    }
    const replacementReason =
      message.email_status === null || message.email_status === "failed"
        ? "purchase_confirmation_replaced"
        : "purchase_confirmation_legacy_preserved";

    const transitioned = await client.query<{ id: string }>(
      `update outbox_messages
       set status = 'superseded',
           superseded_at = now(),
           delivered_at = null,
           locked_at = null,
           locked_by = null,
           last_error_code = $2,
           last_error_at = now(),
           updated_at = now()
       where id = $1 and status in ('pending', 'retrying', 'dead_letter')
       returning id`,
      [message.id, replacementReason]
    );
    if (transitioned.rows[0]) {
      await client.query(
        `insert into audit_logs (action, target_type, target_id, metadata)
         values ('outbox.superseded', 'outbox_message', $1, $2::jsonb)`,
        [message.id, JSON.stringify({ reason: replacementReason })]
      );
    }
  }
};

const ensurePurchaseVerificationChallenge = async ({
  client,
  orderId,
  userId,
}: {
  client: PoolClient;
  orderId: string;
  userId: string;
}): Promise<void> => {
  const existingResult = await client.query<PurchaseVerificationChallengeRow>(
    `
      select id, user_id, purpose, generation, expires_at, consumed_at
      from account_email_challenges
      where order_id = $1
      limit 1
      for update
    `,
    [orderId]
  );
  const existing = existingResult.rows[0];
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  if (existing) {
    if (
      existing.user_id !== userId ||
      existing.purpose !== "purchase_verification"
    ) {
      throw new Error("purchase_verification_challenge_conflict");
    }
    if (existing.consumed_at || existing.expires_at.getTime() <= Date.now()) {
      await client.query(
        `update account_email_challenges
         set generation = generation + 1,
             expires_at = $2,
             consumed_at = null,
             updated_at = now()
         where id = $1 and order_id = $3`,
        [existing.id, expiresAt, orderId]
      );
    }
    return;
  }

  await client.query(
    `insert into account_email_challenges (
       purpose,
       user_id,
       order_id,
       generation,
       expires_at
     ) values ('purchase_verification', $1, $2, 1, $3)
     on conflict (order_id) where order_id is not null do nothing`,
    [userId, orderId, expiresAt]
  );
};

export const enqueuePurchaseConfirmedEmail = async ({
  client,
  enqueueMessage = enqueueOutboxMessage,
  orderId,
  replaceHistorical = false,
  userId,
}: {
  client: PoolClient;
  enqueueMessage?: typeof enqueueOutboxMessage;
  orderId: string;
  replaceHistorical?: boolean;
  userId: string;
}): Promise<PurchaseConfirmationEnqueueResult> => {
  const ledger = await client.query<PurchaseConfirmationLedgerRow>(
    `select origin
     from purchase_confirmation_intents
     where order_id = $1
     limit 1
     for update`,
    [orderId]
  );
  const registeredIntent = ledger.rows[0];
  if (
    registeredIntent?.origin === "current" ||
    (registeredIntent?.origin === "historical" && !replaceHistorical)
  ) {
    return "already_registered";
  }

  const legacyResult = await client.query<LegacyPurchaseEmailRow>(
    `
      select
        message.id,
        message.topic,
        message.status,
        email_messages.status as email_status
      from outbox_messages as message
      left join email_messages on email_messages.outbox_message_id = message.id
      where message.aggregate_type = 'order'
        and message.aggregate_id = $1
        and message.topic = any($2::text[])
      order by message.created_at
      for update of message
    `,
    [orderId, LEGACY_PURCHASE_EMAIL_TOPICS]
  );
  const legacyMessages = legacyResult.rows;
  const priorEmailMayHaveBeenSent =
    hasPotentiallyAcceptedLegacyEmail(legacyMessages);
  const replaceableLegacyMessage = legacyMessages.some(
    (message) =>
      REPLACEABLE_OUTBOX_STATES.has(message.status) &&
      (message.email_status === null || message.email_status === "failed")
  );
  await supersedeUnacceptedLegacyMessages({ client, messages: legacyMessages });

  if (priorEmailMayHaveBeenSent) {
    await client.query(
      `insert into purchase_confirmation_intents (order_id, origin)
       values ($1, 'historical')
       on conflict (order_id) do nothing`,
      [orderId]
    );
    return "legacy_satisfied";
  }

  if (registeredIntent?.origin === "historical" && !replaceableLegacyMessage) {
    return "already_registered";
  }

  const buyer = await client.query<{ email_verified: boolean }>(
    `select email_verified
     from users
     where id = $1
     limit 1
     for update`,
    [userId]
  );
  const buyerRow = buyer.rows[0];
  if (!buyerRow) {
    throw new Error("purchase_confirmation_user_missing");
  }

  const registered = registeredIntent
    ? await client.query<{ order_id: string }>(
        `update purchase_confirmation_intents
         set origin = 'current', updated_at = now()
         where order_id = $1 and origin = 'historical'
         returning order_id`,
        [orderId]
      )
    : await client.query<{ order_id: string }>(
        `insert into purchase_confirmation_intents (order_id, origin)
         values ($1, 'current')
         on conflict (order_id) do nothing
         returning order_id`,
        [orderId]
      );
  if (!registered.rows[0]) {
    return "already_registered";
  }

  if (!buyerRow.email_verified) {
    await ensurePurchaseVerificationChallenge({ client, orderId, userId });
  }
  await enqueueMessage({
    client,
    message: createPurchaseConfirmedMessage({ orderId, userId }),
  });
  return "enqueued";
};
