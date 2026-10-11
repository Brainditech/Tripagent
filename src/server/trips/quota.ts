import { and, count, eq, gte, ne } from "drizzle-orm";

import { db } from "@/server/db";
import { jobs, trips } from "@/server/db/schema";
import { HttpError } from "@/server/http";

/** First instant of the current calendar month, in UTC (PLAN.md: quota months are UTC months). */
export function monthStartUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Generations the user started this month that did not fail: a failed job gives the quota back. */
export async function countTripsThisMonth(userId: string, now: Date = new Date()): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(jobs)
    .innerJoin(trips, eq(jobs.tripId, trips.id))
    .where(
      and(
        eq(trips.userId, userId),
        eq(jobs.kind, "generate"),
        ne(jobs.status, "failed"),
        gte(jobs.createdAt, monthStartUtc(now)),
      ),
    );
  return row?.n ?? 0;
}

/**
 * Refuses a new generation with 429 once the monthly limit is reached. The check
 * and the insert are two queries (the Neon HTTP driver has no transactions), so a
 * double send can exceed the limit by one: accepted for this project (PLAN.md).
 */
export function assertTripQuota(used: number, limit: number): void {
  if (used >= limit) {
    throw new HttpError(429, "quota_exceeded", `Monthly limit of ${limit} trips reached.`);
  }
}
