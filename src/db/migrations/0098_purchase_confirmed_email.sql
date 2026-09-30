CREATE TYPE "public"."purchase_confirmation_intent_origin" AS ENUM('historical', 'current');--> statement-breakpoint
ALTER TYPE "public"."email_delivery_topic" ADD VALUE 'email.purchase-confirmed' BEFORE 'email.support-request';--> statement-breakpoint
ALTER TYPE "public"."email_template_alias" ADD VALUE 'purchase-confirmed' BEFORE 'support-request';--> statement-breakpoint
CREATE TABLE "purchase_confirmation_intents" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"origin" "purchase_confirmation_intent_origin" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_confirmation_intents" ADD CONSTRAINT "purchase_confirmation_intents_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "purchase_confirmation_intents" ("order_id", "origin")
SELECT "orders"."id", 'historical'
FROM "orders"
WHERE "orders"."status" = 'paid'
  AND "orders"."buyer_identity_status" = 'resolved'
  AND "orders"."user_id" IS NOT NULL
ON CONFLICT ("order_id") DO NOTHING;
