import { eventType, staticSchema } from "inngest";

type UserDeletedData = { userId: string };

/** Sent by the Clerk webhook when a Clerk account is deleted. */
export const userDeletedEvent = eventType("user/deleted", {
  schema: staticSchema<UserDeletedData>(),
});

type TripGenerateData = { tripId: string; jobId: string; userId: string };

/** Sent by POST /api/trips once the trip and its job are stored. The event id is the job id. */
export const tripGenerateEvent = eventType("trip/generate", {
  schema: staticSchema<TripGenerateData>(),
});
