import { eq, sql } from "drizzle-orm";

import { clerkClient } from "@/server/auth";
import { db } from "@/server/db";
import { deletedUsers, users } from "@/server/db/schema";

/** What Tripagent keeps of a Clerk account. */
export type ClerkAccount = {
  /** Clerk user id (`user_...`). */
  id: string;
  email: string;
  name: string | null;
  /** Clerk's `updated_at` of the account. */
  updatedAt: Date;
};

/**
 * Inserts the account into `users`, or refreshes email and name if the row
 * exists, unless the data is stale (ADR 0003). One statement decides both: the
 * `WHERE NOT EXISTS` skips an account whose deletion trace is as recent as this
 * `updatedAt`, and the `DO UPDATE ... WHERE` skips a row that already holds a
 * `updatedAt` as recent. Returns whether a row was written.
 */
export async function upsertClerkAccount(account: ClerkAccount): Promise<boolean> {
  const updatedAt = account.updatedAt.toISOString();
  const result = await db.execute(sql`
    insert into ${users} (id, email, name, clerk_updated_at)
    select ${account.id}, ${account.email}, ${account.name}, ${updatedAt}::timestamptz
    where not exists (
      select 1 from ${deletedUsers}
      where ${deletedUsers.id} = ${account.id} and ${deletedUsers.deletedAt} >= ${updatedAt}::timestamptz
    )
    on conflict (id) do update
      set email = excluded.email, name = excluded.name, clerk_updated_at = excluded.clerk_updated_at
      where ${users.clerkUpdatedAt} < excluded.clerk_updated_at
    returning id
  `);
  return result.rows.length > 0;
}

/**
 * Fallback for an account whose webhook has not arrived yet (PLAN.md, Phase 3):
 * makes sure the `users` row exists before a trip references it. Clerk is only
 * read when the row is missing, with the same stale-event rule as the webhook.
 */
export async function ensureUser(userId: string): Promise<void> {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (existing.length > 0) return;

  const user = await clerkClient().users.getUser(userId);
  const primary =
    user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId) ?? user.emailAddresses[0];
  if (!primary) {
    // Clerk requires an email address on every Tripagent account, so this never happens.
    throw new Error(`Clerk user ${userId} has no email address`);
  }
  await upsertClerkAccount({
    id: user.id,
    email: primary.emailAddress,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
    updatedAt: new Date(user.updatedAt),
  });
}
