CREATE TABLE "account_password_reset_operations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"operation" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_password_reset_operations_operation_valid" CHECK ("account_password_reset_operations"."operation" in ('request', 'consume'))
);
--> statement-breakpoint
ALTER TABLE "account_password_reset_operations" ADD CONSTRAINT "account_password_reset_operations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_password_reset_operations_user_expires_idx" ON "account_password_reset_operations" USING btree ("user_id","expires_at");