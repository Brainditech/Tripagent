import { eq } from "drizzle-orm";
import { z } from "zod";

import { authedRoute } from "@/server/auth";
import { db } from "@/server/db";
import { type CustomCover, trips } from "@/server/db/schema";
import { HttpError } from "@/server/http";
import { coverUpload, coverWithUrl, customCoverSchema, fileDetails, isCoverPath, tryDeleteFile } from "@/server/imagekit";
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
 * photo. The upload signature binds neither the folder nor the name (ADR 0005), so
 * the file is read back from ImageKit by its id and accepted only as an image
 * stored in this trip's folder. The cover it replaces leaves ImageKit afterwards.
 */
export const PUT = authedRoute(async ({ request, params, userId }) => {
  const trip = await loadOwnedTrip(params.id, userId);
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = customCoverSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "invalid_cover", z.prettifyError(parsed.error));

  const file = await fileDetails(parsed.data.fileId);
  if (!file || file.fileType !== "image" || !isCoverPath(file.filePath, userId, trip.id)) {
    throw new HttpError(400, "invalid_cover", "The file is not an image in this trip's cover folder.");
  }
  const cover: CustomCover = { fileId: file.fileId, filePath: file.filePath };
  await db.update(trips).set({ coverCustom: cover, updatedAt: new Date() }).where(eq(trips.id, trip.id));

  const previous = trip.coverCustom;
  if (previous && previous.fileId !== cover.fileId) await tryDeleteFile(previous.fileId);
  return Response.json({ coverCustom: coverWithUrl(cover) });
});
