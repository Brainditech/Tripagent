import type { UserJSON } from "@clerk/backend";
import { verifyWebhook, type WebhookEvent } from "@clerk/backend/webhooks";
import { sql } from "drizzle-orm";

import { db } from "@/server/db";
import { deletedUsers, users } from "@/server/db/schema";
import { inngest } from "@/server/inngest/client";
import { userDeletedEvent } from "@/server/inngest/events";

/**
 * Clerk webhook: keeps the `users` table in step with the Clerk accounts.
 *
 * Clerk does not guarantee the order of delivery: a `user.updated` can arrive
 * before the `user.created` of the same account, two updates can cross, and a
 * retried event lands after the ones delivered in the meantime (ADR 0003). So:
 *
 * - `user.created` and `user.updated` are one and the same upsert, applied only
 *   when the event's `updated_at` is newer than the stored one and than any
 *   deletion trace, in a single SQL statement. A stale event answers 200 and
 *   changes nothing, so that Clerk (Svix) does not retry it.
 * - `user.deleted` first records the id and the event time in `deleted_users`,
 *   then hands the clean-up to the Inngest `user/deleted` function, with the
 *   Svix message id as idempotency key: a retried delivery does not run it twice.
 * - A failed write answers 500 so that Clerk (Svix) retries the delivery.
 *
 * No session protects this route. The Svix signature, checked against
 * `CLERK_WEBHOOK_SIGNING_SECRET`, is the only authentication: a request
 * without it, or with a wrong one, is refused with 400.
 */
export async function POST(request: Request) {
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
    console.error("[webhooks/clerk] CLERK_WEBHOOK_SIGNING_SECRET is not set");
    return new Response("Webhook not configured", { status: 500 });
  }

  let event: WebhookEvent;
  try {
    event = await verifyWebhook(request);
  } catch (error) {
    console.warn("[webhooks/clerk] rejected:", error instanceof Error ? error.message : error);
    return new Response("Webhook verification failed", { status: 400 });
  }

  switch (event.type) {
    case "user.created":
    case "user.updated":
      return upsertUser(event.type, event.data);
    case "user.deleted":
      return deleteUser(event.data.id, new Date(event.timestamp), request.headers.get("svix-id"));
    default:
      // Only user.created, user.updated and user.deleted are subscribed in the Clerk Dashboard.
      return Response.json({ received: true, ignored: event.type });
  }
}

/**
 * Inserts the Clerk account into `users`, or refreshes email and name if the row
 * exists, unless the event is stale. One statement decides both: the
 * `WHERE NOT EXISTS` skips an account whose deletion trace is as recent as this
 * `updated_at`, and the `DO UPDATE ... WHERE` skips a row that already holds a
 * `updated_at` as recent. No row returned means nothing was written.
 */
async function upsertUser(type: "user.created" | "user.updated", user: UserJSON): Promise<Response> {
  const email = primaryEmail(user);
  if (!email) {
    // Clerk requires an email address on every Tripagent account, so this never happens.
    console.error(`[webhooks/clerk] ${type} ${user.id} has no email address`);
    return new Response("User has no email address", { status: 400 });
  }
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || null;
  const updatedAt = new Date(user.updated_at).toISOString();

  let written: number;
  try {
    const result = await db.execute(sql`
      insert into ${users} (id, email, name, clerk_updated_at)
      select ${user.id}, ${email}, ${name}, ${updatedAt}::timestamptz
      where not exists (
        select 1 from ${deletedUsers}
        where ${deletedUsers.id} = ${user.id} and ${deletedUsers.deletedAt} >= ${updatedAt}::timestamptz
      )
      on conflict (id) do update
        set email = excluded.email, name = excluded.name, clerk_updated_at = excluded.clerk_updated_at
        where ${users.clerkUpdatedAt} < excluded.clerk_updated_at
      returning id
    `);
    written = result.rows.length;
  } catch (error) {
    console.error(`[webhooks/clerk] ${type} ${user.id}: database write failed`, error);
    return new Response("Database write failed", { status: 500 });
  }

  if (written === 0) {
    console.log(`[webhooks/clerk] ${type} ${user.id} ignored: not newer than the stored account or its deletion`);
    return Response.json({ received: true, userId: user.id, ignored: "stale" });
  }
  console.log(`[webhooks/clerk] ${type} ${user.id} stored`);
  return Response.json({ received: true, userId: user.id });
}

/**
 * Records the deletion in `deleted_users` (a retried event keeps the most recent
 * time), then sends `user/deleted` to Inngest, which deletes the user's data in
 * the background. The trace comes first: once this route has answered 200, a
 * late `user.created` or `user.updated` can no longer recreate the account.
 */
async function deleteUser(userId: string | undefined, deletedAt: Date, svixId: string | null): Promise<Response> {
  if (!userId) {
    console.error("[webhooks/clerk] user.deleted without user id");
    return new Response("user.deleted without user id", { status: 400 });
  }

  try {
    await db
      .insert(deletedUsers)
      .values({ id: userId, deletedAt })
      .onConflictDoUpdate({
        target: deletedUsers.id,
        set: { deletedAt },
        setWhere: sql`${deletedUsers.deletedAt} < excluded.deleted_at`,
      });
  } catch (error) {
    console.error(`[webhooks/clerk] user.deleted ${userId}: database write failed`, error);
    return new Response("Database write failed", { status: 500 });
  }

  try {
    await inngest.send(userDeletedEvent.create({ userId }, { id: svixId ?? undefined }));
  } catch (error) {
    console.error(`[webhooks/clerk] user.deleted ${userId}: could not send user/deleted`, error);
    return new Response("Could not queue the clean-up", { status: 500 });
  }

  console.log(`[webhooks/clerk] user.deleted ${userId} queued`);
  return Response.json({ received: true, userId });
}

/** The primary email address, or the first one when Clerk marks none as primary. */
function primaryEmail(user: UserJSON): string | undefined {
  const primary = user.email_addresses.find((address) => address.id === user.primary_email_address_id);
  return (primary ?? user.email_addresses[0])?.email_address;
}
