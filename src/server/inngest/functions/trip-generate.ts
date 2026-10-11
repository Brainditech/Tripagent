import { eq } from "drizzle-orm";

import { tripDays } from "@/lib/trip-rules";
import { generateItinerary } from "@/server/ai/generate";
import type { ItineraryInput } from "@/server/ai/prompts";
import { toUnresolvedContent, type TripContent } from "@/server/ai/schema";
import { db } from "@/server/db";
import { jobs, trips, tripVersions } from "@/server/db/schema";
import { inngest } from "@/server/inngest/client";
import { tripGenerateEvent } from "@/server/inngest/events";
import { pickCover, type UnsplashCover } from "@/server/unsplash";

/** Step ids, also what `jobs.current_step` holds and what the progress screen displays. */
export const GENERATION_STEPS = {
  start: "load-trip",
  itinerary: "generate-itinerary",
  places: "resolve-places",
  cover: "pick-cover",
  save: "save",
} as const;

/** Records which step is running, for the progress screen. */
async function setCurrentStep(jobId: string, step: string): Promise<void> {
  await db.update(jobs).set({ currentStep: step, updatedAt: new Date() }).where(eq(jobs.id, jobId));
}

/** Marks the trip and its job as failed: the quota does not count a failed job. */
export async function markGenerationFailed(tripId: string, jobId: string, error: string): Promise<void> {
  const now = new Date();
  await db.batch([
    db.update(trips).set({ status: "failed", updatedAt: now }).where(eq(trips.id, tripId)),
    db
      .update(jobs)
      .set({ status: "failed", currentStep: null, error, updatedAt: now, finishedAt: now })
      .where(eq(jobs.id, jobId)),
  ]);
}

/**
 * Generates a trip in four steps: Claude writes the itinerary, places are marked
 * (Google Places comes later: everything stays unresolved), Unsplash provides the
 * cover, and version 1 is saved with the trip set to `ready`. One run at a time
 * per user, five in total, ten starts a minute. When the retries are exhausted,
 * `onFailure` sets the trip and the job to `failed`.
 */
export const tripGenerate = inngest.createFunction(
  {
    id: "trip-generate",
    name: "Generate a trip",
    triggers: [tripGenerateEvent],
    concurrency: [{ key: "event.data.userId", limit: 1 }, { limit: 5 }],
    throttle: { limit: 10, period: "1m" },
    onFailure: async ({ event, error }) => {
      const { tripId, jobId } = event.data.event.data;
      await markGenerationFailed(tripId, jobId, error.message);
      // Sentry capture comes with Phase 10.
      console.error(`[trip-generate] trip ${tripId} failed: ${error.message}`);
    },
  },
  async ({ event, step }) => {
    const { tripId, jobId } = event.data;

    const input = await step.run(GENERATION_STEPS.start, async (): Promise<ItineraryInput> => {
      const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
      if (!trip) throw new Error(`Trip ${tripId} does not exist`);
      const now = new Date();
      await db.batch([
        db.update(trips).set({ status: "generating", updatedAt: now }).where(eq(trips.id, tripId)),
        db.update(jobs).set({ status: "running", updatedAt: now }).where(eq(jobs.id, jobId)),
      ]);
      return {
        destination: trip.destinationName,
        startDate: trip.startDate,
        endDate: trip.endDate,
        days: tripDays(trip.startDate, trip.endDate),
        travelers: trip.travelers,
        budget: trip.budget,
        interests: trip.interests as ItineraryInput["interests"],
        pace: trip.pace,
        locale: trip.locale,
      };
    });

    const generated = await step.run(GENERATION_STEPS.itinerary, async () => {
      await setCurrentStep(jobId, GENERATION_STEPS.itinerary);
      return generateItinerary(input);
    });

    const content = await step.run(GENERATION_STEPS.places, async (): Promise<TripContent> => {
      await setCurrentStep(jobId, GENERATION_STEPS.places);
      return toUnresolvedContent(generated.itinerary);
    });

    const cover = await step.run(GENERATION_STEPS.cover, async (): Promise<UnsplashCover | null> => {
      await setCurrentStep(jobId, GENERATION_STEPS.cover);
      return pickCover(input.destination);
    });

    const saved = await step.run(GENERATION_STEPS.save, async () => {
      await setCurrentStep(jobId, GENERATION_STEPS.save);
      const [version] = await db
        .insert(tripVersions)
        .values({ tripId, versionNumber: 1, content, source: "generate" })
        .returning({ id: tripVersions.id });
      const now = new Date();
      await db.batch([
        db
          .update(trips)
          .set({ status: "ready", currentVersionId: version.id, coverUnsplash: cover, updatedAt: now })
          .where(eq(trips.id, tripId)),
        db
          .update(jobs)
          .set({
            status: "succeeded",
            currentStep: null,
            inputTokens: generated.usage.inputTokens,
            outputTokens: generated.usage.outputTokens,
            updatedAt: now,
            finishedAt: now,
          })
          .where(eq(jobs.id, jobId)),
      ]);
      return { versionId: version.id };
    });

    return {
      tripId,
      versionId: saved.versionId,
      cover: cover?.id ?? null,
      model: generated.model,
      usage: generated.usage,
    };
  },
);
