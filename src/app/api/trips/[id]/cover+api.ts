import { z } from "zod";

import { authedRoute } from "@/server/auth";
import { type CustomCover } from "@/server/db/schema";
import { HttpError } from "@/server/http";
import { coverUpload, coverWithUrl, customCoverSchema, fileDetails, isCoverPath, tryDeleteFile } from "@/server/imagekit";
import { loadOwnedTrip } from "@/server/trips/access";
import { swapCustomCover } from "@/server/trips/cover";

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
 * stored in this trip's folder. The cover it displaces leaves ImageKit afterwards:
 * the one the statement returns, not the one read before, so that two PUTs racing
 * on the same trip never delete the cover the trip ends up with.
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
  const swapped = await swapCustomCover(trip.id, cover);
  if (!swapped) throw new HttpError(404, "not_found", "No such trip.");

  const previous = swapped.previous;
  if (previous && previous.fileId !== cover.fileId) await tryDeleteFile(previous.fileId);
  return Response.json({ coverCustom: coverWithUrl(cover) });
});
