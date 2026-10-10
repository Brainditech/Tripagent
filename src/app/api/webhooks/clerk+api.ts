import type { UserJSON } from "@clerk/backend";
import { verifyWebhook, type WebhookEvent } from "@clerk/backend/webhooks";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { inngest } from "@/server/inngest/client";
import { userDeletedEvent } from "@/server/inngest/events";

/**
 * Clerk webhook: keeps the `users` table in step with the Clerk accounts.
 *
 * - `user.created` and `user.updated` upsert the row right here, so a name or
 *   email changed in Clerk follows. A failed write answers 500 so that Clerk
 *   (Svix) retries the delivery.
 * - `user.deleted` hands the clean-up to the Inngest `user/deleted` function,
 *   with the Svix message id as idempotency key: a retried delivery does not
 *   run it twice.
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
      return queueUserCleanup(event.data.id, request.headers.get("svix-id"));
    default:
      // Only user.created, user.updated and user.deleted are subscribed in the Clerk Dashboard.
      return Response.json({ received: true, ignored: event.type });
  }
}

/** Inserts the Clerk account into `users`, or refreshes email and name if the row exists. */
async function upsertUser(type: "user.created" | "user.updated", user: UserJSON): Promise<Response> {
  const email = primaryEmail(user);
  if (!email) {
    // Clerk requires an email address on every Tripagent account, so this never happens.
    console.error(`[webhooks/clerk] ${type} ${user.id} has no email address`);
    return new Response("User has no email address", { status: 400 });
  }
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || null;

  try {
    await db
      .insert(users)
      .values({ id: user.id, email, name })
      .onConflictDoUpdate({ target: users.id, set: { email, name } });
  } catch (error) {
    console.error(`[webhooks/clerk] ${type} ${user.id}: database write failed`, error);
    return new Response("Database write failed", { status: 500 });
  }

  console.log(`[webhooks/clerk] ${type} ${user.id} stored`);
  return Response.json({ received: true, userId: user.id });
}

/** Sends `user/deleted` to Inngest, which deletes the user's data in the background. */
async function queueUserCleanup(userId: string | undefined, svixId: string | null): Promise<Response> {
  if (!userId) {
    console.error("[webhooks/clerk] user.deleted without user id");
    return new Response("user.deleted without user id", { status: 400 });
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
