import { eventType, staticSchema } from "inngest";

type UserDeletedData = { userId: string };

/** Sent by the Clerk webhook when a Clerk account is deleted. */
export const userDeletedEvent = eventType("user/deleted", {
  schema: staticSchema<UserDeletedData>(),
});
