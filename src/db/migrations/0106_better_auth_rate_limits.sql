CREATE TABLE "better_auth_rate_limits" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"last_request_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "better_auth_rate_limits_request_count_positive_check" CHECK ("better_auth_rate_limits"."request_count" > 0)
);
--> statement-breakpoint
CREATE INDEX "better_auth_rate_limits_expires_at_idx" ON "better_auth_rate_limits" USING btree ("expires_at");