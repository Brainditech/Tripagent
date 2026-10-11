import type { TripContent } from "@/server/ai/schema";
import { db } from "@/server/db";
import { tripVersions } from "@/server/db/schema";

/**
 * The statement that stores version 1 of a generated trip. Inngest retries a step
 * that fails after this insert committed, so a second run must not trip over the
 * unique (trip, number) pair: the conflict rewrites the content in place and still
 * returns the version id.
 */
export function firstVersionUpsert(tripId: string, content: TripContent) {
  return db
    .insert(tripVersions)
    .values({ tripId, versionNumber: 1, content, source: "generate" })
    .onConflictDoUpdate({
      target: [tripVersions.tripId, tripVersions.versionNumber],
      set: { content },
    })
    .returning({ id: tripVersions.id });
}
