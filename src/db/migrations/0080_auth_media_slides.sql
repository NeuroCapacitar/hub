CREATE TABLE "auth_media_slides" (
	"blur_data_url" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_media_slides_sort_order_unique" UNIQUE("sort_order"),
	CONSTRAINT "auth_media_slides_image_url_prefix_check" CHECK ("auth_media_slides"."image_url" like 'auth-media/%'),
	CONSTRAINT "auth_media_slides_sort_order_positive_check" CHECK ("auth_media_slides"."sort_order" > 0)
);
--> statement-breakpoint
CREATE INDEX "auth_media_slides_active_order_idx" ON "auth_media_slides" USING btree ("is_active","sort_order");