import { InngestTestEngine } from "@inngest/test";
import { describe, expect, it, vi } from "vitest";

import { validItinerary } from "@/server/ai/__fixtures__/itinerary";
import type { ItineraryInput } from "@/server/ai/prompts";
import { toUnresolvedContent } from "@/server/ai/schema";
import { GENERATION_STEPS, tripGenerate } from "@/server/inngest/functions/trip-generate";
import type { UnsplashCover } from "@/server/unsplash";

// The function module imports the database client, which needs DATABASE_URL at import time.
// Every step is mocked below, so no query runs (`vi.mock` is hoisted above the imports).
vi.mock("@/server/db", () => ({ db: {} }));

const event = { name: "trip/generate", data: { tripId: "trip-1", jobId: "job-1", userId: "user_1" } };

const input: ItineraryInput = {
  destination: "Tokyo, Japon",
  startDate: "2026-11-02",
  endDate: "2026-11-05",
  days: 4,
  travelers: 2,
  budget: "comfort",
  interests: ["food", "culture"],
  pace: "balanced",
  locale: "fr",
};

const generated = {
  itinerary: validItinerary,
  model: "claude-haiku-4-5-20251001",
  usage: { inputTokens: 1200, outputTokens: 4100 },
};

const cover: UnsplashCover = {
  id: "photo-1",
  urls: { raw: "r", full: "f", regular: "re", small: "s", thumb: "t" },
  alt: "Tokyo at dusk",
  photographer: { name: "Jane Doe", username: "jane", link: "https://unsplash.com/@jane" },
  link: "https://unsplash.com/photos/photo-1",
};

/** Every step mocked, with optional overrides. */
function steps(overrides: Partial<Record<string, () => unknown>> = {}) {
  const handlers: Record<string, () => unknown> = {
    [GENERATION_STEPS.start]: () => input,
    [GENERATION_STEPS.itinerary]: () => generated,
    [GENERATION_STEPS.places]: () => toUnresolvedContent(validItinerary),
    [GENERATION_STEPS.cover]: () => cover,
    [GENERATION_STEPS.save]: () => ({ versionId: "version-1" }),
    ...overrides,
  };
  return Object.entries(handlers).map(([id, handler]) => ({ id, handler }));
}

/** The step ids `step.run` was called with, in order. */
function runStepIds(ctx: { step: unknown }): string[] {
  const run = (ctx.step as { run: { mock: { calls: unknown[][] } } }).run;
  return run.mock.calls.map(([id]) => (typeof id === "string" ? id : (id as { id: string }).id));
}

describe("trip/generate", () => {
  it("runs the steps in order and reports the saved version", async () => {
    const engine = new InngestTestEngine({ function: tripGenerate, events: [event], steps: steps() });
    const { result, error, ctx } = await engine.execute();

    expect(error).toBeUndefined();
    expect(result).toEqual({
      tripId: "trip-1",
      versionId: "version-1",
      cover: "photo-1",
      model: generated.model,
      usage: generated.usage,
    });
    expect(runStepIds(ctx)).toEqual([
      GENERATION_STEPS.start,
      GENERATION_STEPS.itinerary,
      GENERATION_STEPS.places,
      GENERATION_STEPS.cover,
      GENERATION_STEPS.save,
    ]);
  });

  it("finishes without a cover when Unsplash has none", async () => {
    const engine = new InngestTestEngine({
      function: tripGenerate,
      events: [event],
      steps: steps({ [GENERATION_STEPS.cover]: () => null }),
    });
    const { result, error } = await engine.execute();
    expect(error).toBeUndefined();
    expect(result).toMatchObject({ tripId: "trip-1", cover: null });
  });

  it("is configured for one run per user, a global cap and a throttle", () => {
    const options = tripGenerate.opts as {
      concurrency?: { key?: string; limit: number }[];
      throttle?: { limit: number; period: string };
      onFailure?: unknown;
    };
    expect(options.concurrency).toEqual([{ key: "event.data.userId", limit: 1 }, { limit: 5 }]);
    expect(options.throttle).toEqual({ limit: 10, period: "1m" });
    expect(typeof options.onFailure).toBe("function");
  });
});
