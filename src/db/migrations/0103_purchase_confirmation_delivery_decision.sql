ALTER TABLE "purchase_confirmation_intents" ALTER COLUMN "verification_required" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "purchase_confirmation_intents" ALTER COLUMN "verification_required" DROP NOT NULL;
--> statement-breakpoint

UPDATE "purchase_confirmation_intents" AS intent
SET "verification_required" = NULL,
    "updated_at" = now()
WHERE intent."origin" = 'current'
  AND EXISTS (
    SELECT 1
    FROM "outbox_messages" AS message
    WHERE message."aggregate_type" = 'order'
      AND message."aggregate_id" = intent."order_id"::text
      AND message."topic" = 'email.purchase-confirmed'
      AND message."status" IN ('pending', 'retrying', 'dead_letter')
      AND NOT EXISTS (
        SELECT 1
        FROM "email_messages" AS email
        WHERE email."outbox_message_id" = message."id"
          AND email."first_provider_attempt_at" IS NOT NULL
      )
  );
