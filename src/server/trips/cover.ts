import { type SQL, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { type CustomCover, trips } from "@/server/db/schema";

/**
 * The statement that stores `cover` on the trip and returns the cover it displaces,
 * in one go. Postgres updates the latest committed version of the row, and `old` is
 * that version: when two PUTs race on the same trip, the second one learns that it
 * replaced the first one's file, not the file both of them had read. Deleting what
 * this statement returns therefore never removes the cover the trip keeps.
 * `RETURNING old` needs PostgreSQL 18 (Neon runs 18).
 */
export function customCoverSwap(tripId: string, cover: CustomCover): SQL {
  return sql`
    update ${trips}
    set cover_custom = ${JSON.stringify(cover)}::jsonb, updated_at = now()
    where ${trips.id} = ${tripId}
    returning old.cover_custom as previous
  `;
}

/** Stores the cover and returns the one it displaced, or undefined when the trip is gone. */
export async function swapCustomCover(
  tripId: string,
  cover: CustomCover,
): Promise<{ previous: CustomCover | null } | undefined> {
  const result = await db.execute<{ previous: CustomCover | null }>(customCoverSwap(tripId, cover));
  return result.rows[0];
}
