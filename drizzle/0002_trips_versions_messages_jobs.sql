CREATE TYPE "public"."budget_level" AS ENUM('budget', 'comfort', 'luxury');--> statement-breakpoint
CREATE TYPE "public"."job_kind" AS ENUM('generate', 'adjust');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."trip_pace" AS ENUM('relaxed', 'balanced', 'intense');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('queued', 'generating', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."version_source" AS ENUM('generate', 'adjust', 'restore');--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"kind" "job_kind" NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"current_step" text,
	"error" text,
	"inngest_event_id" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "jobs_inngest_event_id_unique" UNIQUE("inngest_event_id")
);
--> statement-breakpoint
CREATE TABLE "trip_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"resulting_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content" jsonb NOT NULL,
	"source" "version_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_versions_trip_id_version_number_unique" UNIQUE("trip_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"destination_name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"travelers" integer NOT NULL,
	"budget" "budget_level" NOT NULL,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"pace" "trip_pace" NOT NULL,
	"locale" text NOT NULL,
	"status" "trip_status" DEFAULT 'queued' NOT NULL,
	"current_version_id" uuid,
	"adjustments_used" integer DEFAULT 0 NOT NULL,
	"cover_unsplash" jsonb,
	"cover_custom" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_messages" ADD CONSTRAINT "trip_messages_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_messages" ADD CONSTRAINT "trip_messages_resulting_version_id_trip_versions_id_fk" FOREIGN KEY ("resulting_version_id") REFERENCES "public"."trip_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_versions" ADD CONSTRAINT "trip_versions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_current_version_id_trip_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."trip_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_trip_id_idx" ON "jobs" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_messages_trip_id_idx" ON "trip_messages" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trips_user_id_idx" ON "trips" USING btree ("user_id");