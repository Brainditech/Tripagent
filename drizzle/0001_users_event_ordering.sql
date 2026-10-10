CREATE TABLE "deleted_users" (
	"id" text PRIMARY KEY NOT NULL,
	"deleted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "clerk_updated_at" timestamp with time zone NOT NULL;