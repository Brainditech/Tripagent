import { eq } from "drizzle-orm";
import { z } from "zod";

import { authedRoute } from "@/server/auth";
import { db } from "@/server/db";
import { trips } from "@/server/db/schema";
import { HttpError } from "@/server/http";
import { coverUpload, coverWithUrl, customCoverSchema, isCoverPath } from "@/server/imagekit";
import { loadOwnedTrip } from "@/server/trips/access";

const uploadRequestSchema = z.object({ mimeType: z.string().max(100).optional() });

/**
 * Signed parameters for uploading a new cover of this trip straight to ImageKit
 * (the private key stays here). The app then records the file with PUT.
 */
export const POST = authedRoute(async ({ request, params, userId }) => {
  const trip = await loadOwnedTrip(params.id, userId);
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = uploadRequestSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "invalid_cover", z.prettifyError(parsed.error));
  return Response.json(await coverUpload(userId, trip.id, parsed.data.mimeType));
});

/**
 * Records the uploaded file as the trip's cover, shown instead of the Unsplash
 * photo. Only a file of this trip's folder is accepted: the signature does not
 * bind the folder, so this is where another user's or trip's file is refused.
 */
export const PUT = authedRoute(async ({ request, params, userId }) => {
  const trip = await loadOwnedTrip(params.id, userId);
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = customCoverSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "invalid_cover", z.prettifyError(parsed.error));
  if (!isCoverPath(parsed.data.filePath, userId, trip.id)) {
    throw new HttpError(400, "invalid_cover", "The file is not in this trip's cover folder.");
  }
  await db.update(trips).set({ coverCustom: parsed.data, updatedAt: new Date() }).where(eq(trips.id, trip.id));
  return Response.json({ coverCustom: coverWithUrl(parsed.data) });
});
