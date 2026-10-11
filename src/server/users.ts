import { isClerkAPIResponseError } from "@clerk/backend/errors";
import { eq, sql } from "drizzle-orm";

import { clerkClient } from "@/server/auth";
import { db } from "@/server/db";
import { deletedUsers, users } from "@/server/db/schema";
import { HttpError } from "@/server/http";

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
 * A session token outlives its account for up to a minute (Clerk JWTs expire, they
 * are not revoked): the deleted account is refused with a clear status, not a 500.
 */
function accountDeleted(): HttpError {
  return new HttpError(403, "account_deleted", "This account was deleted.");
}

/** The Clerk account, or 403 when Clerk no longer knows it. */
async function fetchClerkUser(userId: string) {
  try {
    return await clerkClient().users.getUser(userId);
  } catch (error) {
    if (isClerkAPIResponseError(error) && error.status === 404) throw accountDeleted();
    throw error;
  }
}

async function userExists(userId: string): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  return rows.length > 0;
}

/**
 * Fallback for an account whose webhook has not arrived yet (PLAN.md, Phase 3):
 * makes sure the `users` row exists before a trip references it. Clerk is only
 * read when the row is missing, with the same stale-event rule as the webhook:
 * a deletion trace newer than the account means it was deleted, hence 403.
 */
export async function ensureUser(userId: string): Promise<void> {
  if (await userExists(userId)) return;

  const user = await fetchClerkUser(userId);
  const primary =
    user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId) ?? user.emailAddresses[0];
  if (!primary) {
    // Clerk requires an email address on every Tripagent account, so this never happens.
    throw new Error(`Clerk user ${userId} has no email address`);
  }
  const written = await upsertClerkAccount({
    id: user.id,
    email: primary.emailAddress,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
    updatedAt: new Date(user.updatedAt),
  });
  // Nothing written also happens when the webhook stored the row, as recent as
  // Clerk's answer, between the read above and the upsert: the row decides.
  if (!written && !(await userExists(userId))) throw accountDeleted();
}
