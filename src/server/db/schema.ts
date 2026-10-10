import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
