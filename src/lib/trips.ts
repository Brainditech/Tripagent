import { queryOptions } from "@tanstack/react-query";
import { File } from "expo-file-system";

import type { Api } from "@/lib/api";
import type { BudgetLevel, Interest, Pace } from "@/lib/trip-rules";
import type { TripContent } from "@/server/ai/schema";
import type { CoverUpload, CustomCoverWithUrl } from "@/server/imagekit";
import type { UnsplashCover } from "@/server/unsplash";

// What the trip API routes answer, as the screens read them. The content types come from
// the server as `import type` only, so nothing of the server is bundled in the app.

export type TripStatus = "queued" | "generating" | "ready" | "failed";

/** Answer of `GET /api/trips/[id]`: the trip and the content of its current version. */
export type TripResponse = {
  id: string;
  destinationName: string;
  startDate: string;
  endDate: string;
  days: number;
  travelers: number;
  budget: BudgetLevel;
  interests: Interest[];
  pace: Pace;
  locale: string;
  status: TripStatus;
  adjustmentsUsed: number;
  coverUnsplash: UnsplashCover | null;
  /** The cover the user uploaded, shown instead of the Unsplash photo when present. */
  coverCustom: CustomCoverWithUrl | null;
  createdAt: string;
  updatedAt: string;
  /** Null until the generation has produced a version. */
  version: { number: number; content: TripContent } | null;
};

/** Answer of `GET /api/trips/[id]/status`: what the progress screen polls. */
export type TripStatusResponse = {
  id: string;
  destinationName: string;
  status: TripStatus;
  job: { status: string; currentStep: string | null; error: string | null } | null;
};

/** The trip with its content; shared by the progress and detail screens so the cache carries over. */
export function tripQueryOptions(api: Api, id: string) {
  return queryOptions({
    queryKey: ["trip", id],
    queryFn: () => api.get<TripResponse>(`/api/trips/${id}`),
  });
}

/** Google Maps search for a place, by its `placeId` when it was resolved, by its name otherwise. */
export function googleMapsUrl(place: { query: string; placeId: string | null }): string {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.query)}`;
  return place.placeId ? `${url}&query_place_id=${encodeURIComponent(place.placeId)}` : url;
}

/**
 * An Unsplash link with the referral parameters the Unsplash guidelines ask for.
 * Built by hand: React Native's `URL` does not implement `searchParams.set`.
 */
export function unsplashReferralUrl(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}utm_source=tripagent&utm_medium=referral`;
}

/** Largest width a stored cover can have (see `COVER_PRE_TRANSFORMATION` on the server). */
const MAX_COVER_WIDTH = 2000;

/**
 * The ImageKit URL of a custom cover resized for this device: the width in pixels
 * is rounded up to a 360 px step so the CDN keeps a handful of variants, never
 * enlarged (`c-at_max`), at quality 80 in the best format the device accepts.
 */
export function customCoverUrl(cover: { url: string }, widthPx: number): string {
  const width = Math.min(MAX_COVER_WIDTH, Math.max(360, Math.ceil(widthPx / 360) * 360));
  return `${cover.url}?tr=w-${width},c-at_max,q-80,f-auto`;
}

/** The image the picker returned, as the upload needs it. */
export type PickedImage = { uri: string; mimeType?: string };

type ImageKitUploadResponse = { fileId?: string; filePath?: string; message?: string };

/**
 * Makes a picked image the trip's cover: the API signs the upload (the private key
 * stays on the server), the file goes straight from the phone to ImageKit, then
 * the API records the file id and path in `cover_custom`.
 */
export async function uploadTripCover(
  api: Api,
  tripId: string,
  image: PickedImage,
  fetchImpl: typeof fetch = fetch,
): Promise<CustomCoverWithUrl> {
  const upload = await api.post<CoverUpload>(`/api/trips/${tripId}/cover`, { mimeType: image.mimeType });

  const form = new FormData();
  for (const [name, value] of Object.entries(upload.fields)) form.append(name, value);
  // Expo's fetch sends a `File` as a multipart part (its name, type and bytes); it does not
  // take React Native's `{ uri, name, type }` part.
  form.append("file", new File(image.uri));
  const response = await fetchImpl(upload.url, { method: "POST", headers: { Accept: "application/json" }, body: form });
  const result = (await response.json().catch(() => null)) as ImageKitUploadResponse | null;
  if (!response.ok || !result?.fileId || !result.filePath) {
    throw new Error(result?.message ?? `ImageKit answered ${response.status}`);
  }

  const saved = await api.put<{ coverCustom: CustomCoverWithUrl }>(`/api/trips/${tripId}/cover`, {
    fileId: result.fileId,
    filePath: result.filePath,
  });
  return saved.coverCustom;
}
