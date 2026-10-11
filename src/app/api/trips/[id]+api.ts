import { eq } from "drizzle-orm";

import { tripDays } from "@/lib/trip-rules";
import { authedRoute } from "@/server/auth";
import { db } from "@/server/db";
import { trips, tripVersions } from "@/server/db/schema";
import { coverWithUrl, tryDeleteFile } from "@/server/imagekit";
import { loadOwnedTrip } from "@/server/trips/access";

/** One trip with the content of its current version (null until it is ready). */
export const GET = authedRoute(async ({ params, userId }) => {
  const trip = await loadOwnedTrip(params.id, userId);
  const [version] = trip.currentVersionId
    ? await db
        .select({ versionNumber: tripVersions.versionNumber, content: tripVersions.content })
        .from(tripVersions)
        .where(eq(tripVersions.id, trip.currentVersionId))
        .limit(1)
    : [];
  return Response.json({
    id: trip.id,
    destinationName: trip.destinationName,
    startDate: trip.startDate,
    endDate: trip.endDate,
    days: tripDays(trip.startDate, trip.endDate),
    travelers: trip.travelers,
    budget: trip.budget,
    interests: trip.interests,
    pace: trip.pace,
    locale: trip.locale,
    status: trip.status,
    adjustmentsUsed: trip.adjustmentsUsed,
    coverUnsplash: trip.coverUnsplash,
    coverCustom: coverWithUrl(trip.coverCustom),
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
    version: version ? { number: version.versionNumber, content: version.content } : null,
  });
});

/**
 * Deletes the trip; versions, messages and jobs follow by cascade, then the custom
 * cover leaves ImageKit. The row is gone whatever ImageKit answers: a file left
 * behind is logged, not fatal.
 */
export const DELETE = authedRoute(async ({ params, userId }) => {
  const trip = await loadOwnedTrip(params.id, userId);
  await db.delete(trips).where(eq(trips.id, trip.id));
  if (trip.coverCustom) await tryDeleteFile(trip.coverCustom.fileId);
  return new Response(null, { status: 204 });
});
