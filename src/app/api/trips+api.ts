import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { tripDays } from "@/lib/trip-rules";
import { authedRoute } from "@/server/auth";
import { config } from "@/server/config";
import { db } from "@/server/db";
import { jobs, trips, users } from "@/server/db/schema";
import { HttpError } from "@/server/http";
import { coverWithUrl } from "@/server/imagekit";
import { inngest } from "@/server/inngest/client";
import { tripGenerateEvent } from "@/server/inngest/events";
import { markGenerationFailed } from "@/server/inngest/functions/trip-generate";
import { assertTripQuota, countTripsThisMonth } from "@/server/trips/quota";
import { newTripSchema } from "@/server/trips/schema";
import { ensureUser } from "@/server/users";

/** The user's trips, newest first, as the home list shows them. */
export const GET = authedRoute(async ({ userId }) => {
  const rows = await db
    .select({
      id: trips.id,
      destinationName: trips.destinationName,
      startDate: trips.startDate,
      endDate: trips.endDate,
      travelers: trips.travelers,
      budget: trips.budget,
      status: trips.status,
      coverUnsplash: trips.coverUnsplash,
      coverCustom: trips.coverCustom,
      createdAt: trips.createdAt,
    })
    .from(trips)
    .where(eq(trips.userId, userId))
    .orderBy(desc(trips.createdAt));
  return Response.json({
    trips: rows.map((trip) => ({
      ...trip,
      days: tripDays(trip.startDate, trip.endDate),
      coverCustom: coverWithUrl(trip.coverCustom),
    })),
  });
});

/**
 * Starts a generation: validates the form, checks the monthly quota, stores the
 * trip and its job, then sends `trip/generate` with the job id as event id (a
 * second send of the same job is ignored by Inngest). Answers 202 with the trip id.
 */
export const POST = authedRoute(async ({ request, userId }) => {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = newTripSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, "invalid_trip", z.prettifyError(parsed.error));
  }
  const input = parsed.data;

  await ensureUser(userId);
  const [user] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, userId)).limit(1);
  assertTripQuota(await countTripsThisMonth(userId), config.quotas.tripsPerMonth);

  const [trip] = await db
    .insert(trips)
    .values({
      userId,
      destinationName: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
      travelers: input.travelers,
      budget: input.budget,
      interests: input.interests,
      pace: input.pace,
      locale: user.locale,
    })
    .returning({ id: trips.id });

  // The job id is generated here so that it can serve as the Inngest event id.
  const jobId = crypto.randomUUID();
  await db.insert(jobs).values({ id: jobId, tripId: trip.id, kind: "generate", inngestEventId: jobId });

  try {
    await inngest.send(tripGenerateEvent.create({ tripId: trip.id, jobId, userId }, { id: jobId }));
  } catch (error) {
    console.error(`[api/trips] could not queue trip ${trip.id}`, error);
    await markGenerationFailed(trip.id, jobId, "The generation could not be queued");
    throw new HttpError(503, "queue_unavailable", "The generation could not be started. Try again.");
  }

  return Response.json({ tripId: trip.id }, { status: 202 });
});
