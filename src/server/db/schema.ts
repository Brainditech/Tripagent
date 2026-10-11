import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import type { TripContent } from "@/server/ai/schema";
import type { UnsplashCover } from "@/server/unsplash";

/**
 * Mirror of the Clerk accounts, kept in step by the Clerk webhook
 * (`src/app/api/webhooks/clerk+api.ts`): `user.created` and `user.updated`
 * upsert a row, `user.deleted` removes it through the Inngest `user/deleted` function.
 *
 * Clerk does not deliver its events in order (ADR 0003), so each row keeps the
 * Clerk `updated_at` it was written from, and only a newer event replaces it.
 */
export const users = pgTable("users", {
  /** Clerk user id (`user_...`). */
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  /** Nullable: an account created with an email code has no name. */
  name: text("name"),
  /** Language tag. Clerk does not send one, so it is French until the app reports the device language. */
  locale: text("locale").notNull().default("fr"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Clerk's `updated_at` of the account, as carried by the event last written. */
  clerkUpdatedAt: timestamp("clerk_updated_at", { withTimezone: true }).notNull(),
});

/**
 * Trace of the deleted Clerk accounts: the id and the time of the `user.deleted`
 * event. A `user.created` or `user.updated` that is not newer than the trace
 * arrived late (a retry, or an event overtaken by the deletion) and must not
 * bring the row back. Clerk never reuses a user id, so the trace can stay.
 */
export const deletedUsers = pgTable("deleted_users", {
  /** Clerk user id (`user_...`). */
  id: text("id").primaryKey(),
  /** `timestamp` of the `user.deleted` event. */
  deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull(),
});

export const tripStatus = pgEnum("trip_status", ["queued", "generating", "ready", "failed"]);
export const budgetLevel = pgEnum("budget_level", ["budget", "comfort", "luxury"]);
export const tripPace = pgEnum("trip_pace", ["relaxed", "balanced", "intense"]);
export const versionSource = pgEnum("version_source", ["generate", "adjust", "restore"]);
export const messageRole = pgEnum("message_role", ["user", "assistant"]);
export const jobKind = pgEnum("job_kind", ["generate", "adjust"]);
export const jobStatus = pgEnum("job_status", ["queued", "running", "succeeded", "failed"]);

/** A user-uploaded cover, stored on ImageKit (Phase 8). */
export type CustomCover = { fileId: string; filePath: string };

/**
 * One trip request and its state. The form fields follow the mockups: a free-text
 * destination (Google Places comes later, with the detail screen), exact dates
 * (the number of days derives from them, 10 at most), a budget level, a number
 * of travellers, interests and a pace. No address or coordinates are stored
 * anywhere: only `placeId`s may appear inside the versions' content.
 */
export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** As typed by the user. */
    destinationName: text("destination_name").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    travelers: integer("travelers").notNull(),
    budget: budgetLevel("budget").notNull(),
    interests: text("interests")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    pace: tripPace("pace").notNull(),
    /** Language of the generated content, copied from the user at creation. */
    locale: text("locale").notNull(),
    status: tripStatus("status").notNull().default("queued"),
    currentVersionId: uuid("current_version_id").references((): AnyPgColumn => tripVersions.id, {
      onDelete: "set null",
    }),
    adjustmentsUsed: integer("adjustments_used").notNull().default(0),
    /** Unsplash photo shown as cover: hotlinked URLs and the photographer's credit. */
    coverUnsplash: jsonb("cover_unsplash").$type<UnsplashCover>(),
    coverCustom: jsonb("cover_custom").$type<CustomCover>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("trips_user_id_idx").on(table.userId)],
);

/** Every content produced for a trip: version 1 by the generation, then one per adjustment or restore. */
export const tripVersions = pgTable(
  "trip_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    content: jsonb("content").$type<TripContent>().notNull(),
    source: versionSource("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("trip_versions_trip_id_version_number_unique").on(table.tripId, table.versionNumber)],
);

/** The adjustment chat (Phase 7). */
export const tripMessages = pgTable(
  "trip_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    role: messageRole("role").notNull(),
    content: text("content").notNull(),
    /** The version an assistant message produced, if any. */
    resultingVersionId: uuid("resulting_version_id").references(() => tripVersions.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("trip_messages_trip_id_idx").on(table.tripId)],
);

/**
 * One background job per generation or adjustment. The monthly quota counts the
 * `generate` jobs that did not fail, and the progress screen reads `current_step`.
 */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    kind: jobKind("kind").notNull(),
    status: jobStatus("status").notNull().default("queued"),
    /** Id of the Inngest step being executed, or null before the first and after the last. */
    currentStep: text("current_step"),
    error: text("error"),
    /** Id of the Inngest event that started the job (the job id itself), unique so a double send is refused. */
    inngestEventId: text("inngest_event_id").unique(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [index("jobs_trip_id_idx").on(table.tripId)],
);

/**
 * Generations a user reserved in a calendar month (UTC), the monthly quota. One
 * statement reserves a slot only while `used` is under the limit, so concurrent
 * requests cannot exceed it, and the row outlives the trips and jobs themselves,
 * so deleting a trip does not give the slot back (a failed generation does).
 */
export const monthlyGenerations = pgTable(
  "monthly_generations",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** First day of the UTC month, as `YYYY-MM-01`. */
    month: date("month", { mode: "string" }).notNull(),
    used: integer("used").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.month] })],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
export type TripVersion = typeof tripVersions.$inferSelect;
export type Job = typeof jobs.$inferSelect;
