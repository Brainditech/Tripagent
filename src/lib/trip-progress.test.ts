import { describe, expect, it } from "vitest";

import { progressOf, STAGES, stageState } from "@/lib/trip-progress";

const JOB_STEPS = ["load-trip", "generate-itinerary", "resolve-places", "pick-cover", "save"];

describe("progressOf", () => {
  it("starts at the first stage while the job is queued, not yet polled or not yet in a step", () => {
    for (const progress of [progressOf(undefined, undefined), progressOf("queued", null), progressOf("generating", null)]) {
      expect(progress.stage).toBe(0);
      expect(progress.target).toBeGreaterThan(0);
      expect(progress.target).toBeLessThan(0.1);
    }
  });

  it("maps the five job steps to the three stages, with a bar that only moves forward", () => {
    const progress = JOB_STEPS.map((step) => progressOf("generating", step));
    expect(progress.map((p) => p.stage)).toEqual([0, 0, 1, 2, 2]);
    const targets = progress.map((p) => p.target);
    expect(targets).toEqual([...targets].sort((a, b) => a - b));
    expect(targets.every((target) => target > 0 && target < 1)).toBe(true);
    expect(progress.every((p) => p.durationMs > 0)).toBe(true);
  });

  it("gives the itinerary step, the long one, the longest creep", () => {
    const itinerary = progressOf("generating", "generate-itinerary");
    for (const step of JOB_STEPS.filter((s) => s !== "generate-itinerary")) {
      expect(progressOf("generating", step).durationMs).toBeLessThan(itinerary.durationMs);
    }
  });

  it("fills the bar and marks every stage done once the trip is ready", () => {
    const ready = progressOf("ready", null);
    expect(ready.target).toBe(1);
    expect(STAGES.map((_, index) => stageState(index, ready))).toEqual(["done", "done", "done"]);
  });

  it("tells the stages apart around the running one", () => {
    const places = progressOf("generating", "resolve-places");
    expect(STAGES.map((_, index) => stageState(index, places))).toEqual(["done", "current", "pending"]);
    const save = progressOf("generating", "save");
    expect(STAGES.map((_, index) => stageState(index, save))).toEqual(["done", "done", "current"]);
  });

  it("falls back to the first stage for a step it does not know", () => {
    expect(progressOf("generating", "something-new").stage).toBe(0);
  });
});
