import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Mirror of the Clerk accounts, kept in step by the Clerk webhook
 * (`src/app/api/webhooks/clerk+api.ts`): `user.created` and `user.updated`
 * upsert a row, `user.deleted` removes it through the Inngest `user/deleted` function.
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
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
