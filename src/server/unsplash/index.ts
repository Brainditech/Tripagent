import { requireEnv } from "@/server/config";

/**
 * What is stored for an Unsplash cover: the hotlinked URLs, the photographer's
 * credit and the photo page, as the Unsplash guidelines require. The URLs are
 * displayed directly by the app, never proxied or copied.
 */
export type UnsplashCover = {
  id: string;
  urls: { raw: string; full: string; regular: string; small: string; thumb: string };
  alt: string | null;
  photographer: { name: string; username: string; link: string };
  /** The photo's page on unsplash.com. */
  link: string;
};

type SearchResponse = {
  results: {
    id: string;
    alt_description: string | null;
    urls: UnsplashCover["urls"];
    links: { html: string; download_location: string };
    user: { name: string; username: string; links: { html: string } };
  }[];
};

const API = "https://api.unsplash.com";

/**
 * Picks the first landscape photo matching the destination and triggers its
 * `download_location`, which the Unsplash guidelines require whenever a photo is
 * selected. Returns null when nothing matches or when Unsplash fails: a trip
 * without cover is better than a failed trip, and the demo rate limit (50/h) would
 * otherwise turn into retries.
 */
export async function pickCover(query: string, fetchImpl: typeof fetch = fetch): Promise<UnsplashCover | null> {
  const headers = { Authorization: `Client-ID ${requireEnv("UNSPLASH_ACCESS_KEY")}`, "Accept-Version": "v1" };
  try {
    const params = new URLSearchParams({ query, per_page: "1", orientation: "landscape", content_filter: "high" });
    const response = await fetchImpl(`${API}/search/photos?${params}`, { headers });
    if (!response.ok) {
      console.warn(`[unsplash] search "${query}" answered ${response.status}`);
      return null;
    }
    const photo = ((await response.json()) as SearchResponse).results[0];
    if (!photo) return null;

    // Counts as a download for the photographer; the response body is not needed.
    const trigger = await fetchImpl(photo.links.download_location, { headers });
    if (!trigger.ok) console.warn(`[unsplash] download_location for ${photo.id} answered ${trigger.status}`);

    return {
      id: photo.id,
      urls: photo.urls,
      alt: photo.alt_description,
      photographer: { name: photo.user.name, username: photo.user.username, link: photo.user.links.html },
      link: photo.links.html,
    };
  } catch (error) {
    console.warn(`[unsplash] search "${query}" failed`, error);
    return null;
  }
}

/** Most destination photos remembered; past that, the oldest entry leaves first. */
const MAX_CACHED_PHOTOS = 200;

const photoCache = new Map<string, Promise<UnsplashCover | null>>();

/**
 * The photo of a destination card of the assistant, looked up once per process: the same
 * destination comes back often ("Lisbon, Portugal"), and the demo rate limit (50/h) would not
 * take four requests per answer for long. A miss or a failure is not kept, so that the next
 * request may find the photo.
 */
export function cachedPhoto(query: string, fetchImpl: typeof fetch = fetch): Promise<UnsplashCover | null> {
  const key = query.trim().toLowerCase();
  const cached = photoCache.get(key);
  if (cached) return cached;

  const lookup = pickCover(query, fetchImpl).then((photo) => {
    if (!photo) photoCache.delete(key);
    return photo;
  });
  photoCache.set(key, lookup);
  if (photoCache.size > MAX_CACHED_PHOTOS) {
    const oldest = photoCache.keys().next().value;
    if (oldest !== undefined) photoCache.delete(oldest);
  }
  return lookup;
}

/** Forgets every photo; for the tests. */
export function clearPhotoCache(): void {
  photoCache.clear();
}
