CREATE TABLE "monthly_generations" (
	"user_id" text NOT NULL,
	"month" date NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_generations_user_id_month_pk" PRIMARY KEY("user_id","month")
);
--> statement-breakpoint
ALTER TABLE "monthly_generations" ADD CONSTRAINT "monthly_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "monthly_generations" ("user_id", "month", "used")
SELECT t."user_id", (date_trunc('month', j."created_at" AT TIME ZONE 'UTC'))::date, count(*)::int
FROM "jobs" j JOIN "trips" t ON t."id" = j."trip_id"
WHERE j."kind" = 'generate' AND j."status" <> 'failed'
GROUP BY 1, 2;
