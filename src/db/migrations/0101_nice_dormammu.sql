ALTER TABLE "purchase_confirmation_intents" ADD COLUMN "verification_required" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

UPDATE "purchase_confirmation_intents" AS intent
SET "verification_required" = NOT users."email_verified"
FROM "orders"
JOIN "users" ON "users"."id" = "orders"."user_id"
WHERE "orders"."id" = intent."order_id";
