import { desc, eq } from "drizzle-orm";

import { authedRoute } from "@/server/auth";
import { db } from "@/server/db";
import { jobs } from "@/server/db/schema";
import { loadOwnedTrip } from "@/server/trips/access";

/** What the progress screen polls: the trip status and the step of its latest job. */
export const GET = authedRoute(async ({ params, userId }) => {
  const trip = await loadOwnedTrip(params.id, userId);
  const [job] = await db
    .select({ status: jobs.status, currentStep: jobs.currentStep, error: jobs.error, updatedAt: jobs.updatedAt })
    .from(jobs)
    .where(eq(jobs.tripId, trip.id))
    .orderBy(desc(jobs.createdAt))
    .limit(1);
  return Response.json({
    id: trip.id,
    destinationName: trip.destinationName,
    status: trip.status,
    job: job ?? null,
  });
});
