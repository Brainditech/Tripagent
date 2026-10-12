import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { cachedPhoto, clearPhotoCache, pickCover } from "@/server/unsplash";

const photo = {
  id: "abc123",
  alt_description: "Lisbon rooftops",
  urls: { raw: "r", full: "f", regular: "g", small: "s", thumb: "t" },
  links: { html: "https://unsplash.com/photos/abc123", download_location: "https://api.unsplash.com/photos/abc123/download" },
  user: { name: "Ana", username: "ana", links: { html: "https://unsplash.com/@ana" } },
};

/** An Unsplash that finds `results` for every search and accepts every download trigger. */
function fakeUnsplash(results: unknown[]) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/search/photos")) return Response.json({ results });
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
}

describe("cachedPhoto", () => {
  beforeAll(() => {
    process.env.UNSPLASH_ACCESS_KEY = "test-key";
  });
  beforeEach(() => clearPhotoCache());

  it("searches once per destination, whatever the case or spacing of the query", async () => {
    const fetchImpl = fakeUnsplash([photo]);
    const first = await cachedPhoto("Lisbon, Portugal", fetchImpl);
    const second = await cachedPhoto("  lisbon, portugal ", fetchImpl);
    expect(first?.id).toBe("abc123");
    expect(second).toBe(first);
    // One search and one download trigger, not two of each.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("answers null, not an error, when no access key is configured", async () => {
    const key = process.env.UNSPLASH_ACCESS_KEY;
    delete process.env.UNSPLASH_ACCESS_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const fetchImpl = fakeUnsplash([photo]);
      await expect(pickCover("Lisbon, Portugal", fetchImpl)).resolves.toBeNull();
      await expect(cachedPhoto("Lisbon, Portugal", fetchImpl)).resolves.toBeNull();
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
    } finally {
      process.env.UNSPLASH_ACCESS_KEY = key;
      warn.mockRestore();
    }
  });

  it("does not remember a miss, so the next request searches again", async () => {
    const fetchImpl = fakeUnsplash([]);
    expect(await cachedPhoto("Nowhere", fetchImpl)).toBeNull();
    expect(await cachedPhoto("Nowhere", fetchImpl)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
