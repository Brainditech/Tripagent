import { and, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { monthlyGenerations } from "@/server/db/schema";
import { HttpError } from "@/server/http";

// The monthly quota of generations (PLAN.md: quota months are UTC months; ADR 0004).
// It lives in `monthly_generations`, one row per user and month, rather than being
// counted from the jobs: a job disappears with its trip, and a count followed by an
// insert lets concurrent requests through. One upsert reserves a slot atomically.

/** First instant of the current calendar month, in UTC. */
export function monthStartUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** The `month` key of a quota row: the first day of the UTC month, as `YYYY-MM-01`. */
export function quotaMonth(now: Date = new Date()): string {
  return monthStartUtc(now).toISOString().slice(0, 10);
}

/**
 * The statement that reserves one generation of `month` for the user: inserts the
 * row at 1, or adds 1 only while `used` is under `limit`. Postgres locks the row on
 * conflict and evaluates the WHERE on its latest version, so two requests cannot
 * both take the last slot. Returns no row when the quota is exhausted.
 */
export function tripQuotaReservation(userId: string, limit: number, month: string) {
  return db
    .insert(monthlyGenerations)
    .values({ userId, month, used: 1 })
    .onConflictDoUpdate({
      target: [monthlyGenerations.userId, monthlyGenerations.month],
      set: { used: sql`${monthlyGenerations.used} + 1`, updatedAt: new Date() },
      setWhere: sql`${monthlyGenerations.used} < ${limit}`,
    })
    .returning({ used: monthlyGenerations.used });
}

/** Reserves a generation of the month, or answers 429 once the monthly limit is reached. */
export async function reserveTripQuota(userId: string, limit: number, month: string = quotaMonth()): Promise<number> {
  const [row] = limit > 0 ? await tripQuotaReservation(userId, limit, month) : [];
  if (!row) throw new HttpError(429, "quota_exceeded", `Monthly limit of ${limit} trips reached.`);
  return row.used;
}

/** Gives a reserved generation back (a failed job, or a trip that could not be stored), never below 0. */
export async function releaseTripQuota(userId: string, month: string): Promise<void> {
  await db
    .update(monthlyGenerations)
    .set({ used: sql`greatest(${monthlyGenerations.used} - 1, 0)`, updatedAt: new Date() })
    .where(and(eq(monthlyGenerations.userId, userId), eq(monthlyGenerations.month, month)));
}

/** Generations the user has reserved this month. */
export async function usedTripQuota(userId: string, month: string = quotaMonth()): Promise<number> {
  const [row] = await db
    .select({ used: monthlyGenerations.used })
    .from(monthlyGenerations)
    .where(and(eq(monthlyGenerations.userId, userId), eq(monthlyGenerations.month, month)))
    .limit(1);
  return row?.used ?? 0;
}
