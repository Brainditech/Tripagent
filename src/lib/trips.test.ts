import { describe, expect, it, vi } from "vitest";

import { isGenerating, tripCoverUri, tripHref, type TripSummary } from "@/lib/trips";
import type { UnsplashCover } from "@/server/unsplash";

// Only the pure helpers of the lists are under test; the native modules the file imports for
// the cover upload are replaced (vi.mock is hoisted above the imports).
vi.mock("@sentry/react-native", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("expo-file-system", () => ({ File: class {} }));

const unsplash: UnsplashCover = {
  id: "abc",
  urls: { raw: "u/raw", full: "u/full", regular: "u/regular", small: "u/small", thumb: "u/thumb" },
  alt: null,
  photographer: { name: "Ana", username: "ana", link: "https://unsplash.com/@ana" },
  link: "https://unsplash.com/photos/abc",
};

function summary(overrides: Partial<TripSummary> = {}): TripSummary {
  return {
    id: "trip-1",
    destinationName: "Lisbonne, Portugal",
    startDate: "2026-10-11",
    endDate: "2026-10-13",
    days: 3,
    travelers: 2,
    budget: "comfort",
    status: "ready",
    coverUnsplash: unsplash,
    coverCustom: null,
    createdAt: "2026-10-11T09:20:00.000Z",
    title: "3 jours à Lisbonne",
    estimatedCost: { perPerson: 525, currency: "EUR" },
    ...overrides,
  };
}

describe("isGenerating", () => {
  it("is true while the trip is queued or generating, false once ready or failed", () => {
    expect(isGenerating({ status: "queued" })).toBe(true);
    expect(isGenerating({ status: "generating" })).toBe(true);
    expect(isGenerating({ status: "ready" })).toBe(false);
    expect(isGenerating({ status: "failed" })).toBe(false);
  });
});

describe("tripHref", () => {
  it("leads to the progress screen while the trip is generated, to the detail otherwise", () => {
    expect(tripHref(summary({ status: "generating" }))).toEqual({ pathname: "/trips/[id]/progress", params: { id: "trip-1" } });
    expect(tripHref(summary({ status: "ready" }))).toEqual({ pathname: "/trips/[id]", params: { id: "trip-1" } });
    expect(tripHref(summary({ status: "failed" }))).toEqual({ pathname: "/trips/[id]", params: { id: "trip-1" } });
  });
});

describe("tripCoverUri", () => {
  it("prefers the user's own cover, sized for the card", () => {
    const custom = { fileId: "f1", filePath: "/tripagent/covers/u/t/cover.jpg", url: "https://ik.example/cover.jpg" };
    expect(tripCoverUri(summary({ coverCustom: custom }), 540)).toBe("https://ik.example/cover.jpg?tr=w-720,c-at_max,q-80,f-auto");
  });

  it("falls back to the Unsplash photo in the detail's size, then to none", () => {
    expect(tripCoverUri(summary(), 540)).toBe("u/regular");
    expect(tripCoverUri(summary({ coverUnsplash: null }), 540)).toBeNull();
  });
});
