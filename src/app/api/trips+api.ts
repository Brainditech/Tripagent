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
import { quotaMonth, releaseTripQuota, reserveTripQuota } from "@/server/trips/quota";
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
 * Starts a generation: validates the form, reserves a slot of the monthly quota
 * (429 when it is exhausted), stores the trip and its job, then sends
 * `trip/generate` with the job id as event id (a second send of the same job is
 * ignored by Inngest). Answers 202 with the trip id. A slot is given back when the
 * trip cannot be stored or queued, and later if the generation fails.
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
  const month = quotaMonth();
  await reserveTripQuota(userId, config.quotas.tripsPerMonth, month);

  // The job id is generated here so that it can serve as the Inngest event id.
  const jobId = crypto.randomUUID();
  let tripId: string;
  try {
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
    tripId = trip.id;
    await db.insert(jobs).values({ id: jobId, tripId, kind: "generate", inngestEventId: jobId });
  } catch (error) {
    await releaseTripQuota(userId, month);
    throw error;
  }

  try {
    await inngest.send(tripGenerateEvent.create({ tripId, jobId, userId }, { id: jobId }));
  } catch (error) {
    console.error(`[api/trips] could not queue trip ${tripId}`, error);
    await markGenerationFailed(tripId, jobId, userId, "The generation could not be queued");
    throw new HttpError(503, "queue_unavailable", "The generation could not be started. Try again.");
  }

  return Response.json({ tripId }, { status: 202 });
});
