import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { type Trip, trips } from "@/server/db/schema";
import { HttpError } from "@/server/http";

const uuid = z.uuid();

/**
 * The trip with this id, or 404 when it does not exist (or the id is not a uuid),
 * or 403 when it belongs to someone else.
 */
export async function loadOwnedTrip(id: string, userId: string): Promise<Trip> {
  if (!uuid.safeParse(id).success) throw new HttpError(404, "not_found", "No such trip.");
  const [trip] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  if (!trip) throw new HttpError(404, "not_found", "No such trip.");
  if (trip.userId !== userId) throw new HttpError(403, "forbidden", "This trip belongs to another user.");
  return trip;
}
