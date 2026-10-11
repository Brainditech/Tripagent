import type { TripStatus } from "@/lib/trips";

// What the progress screen shows of a generation: three stages for the five job steps
// (`GENERATION_STEPS` in src/server/inngest/functions/trip-generate.ts), and a bar that
// keeps creeping while a step runs, since the itinerary step alone takes most of the
// time (about 45 s) and the status is only polled every few seconds.

/** The stages of the stepper, in the order the generation runs them. */
export const STAGES = ["itinerary", "places", "finish"] as const;
export type Stage = (typeof STAGES)[number];

type StepInfo = { stage: Stage; ceiling: number; creepMs: number };

/**
 * For each job step: its stage, how far the bar may creep while the step runs (its
 * share of a usual generation), and how long the creep takes to get there.
 */
const STEPS: Record<string, StepInfo> = {
  "load-trip": { stage: "itinerary", ceiling: 0.08, creepMs: 8_000 },
  "generate-itinerary": { stage: "itinerary", ceiling: 0.72, creepMs: 45_000 },
  "resolve-places": { stage: "places", ceiling: 0.82, creepMs: 6_000 },
  "pick-cover": { stage: "finish", ceiling: 0.92, creepMs: 8_000 },
  save: { stage: "finish", ceiling: 0.97, creepMs: 6_000 },
};

/** Before the job runs (queued, or not polled yet), the bar starts moving a little. */
const QUEUED: StepInfo = { stage: "itinerary", ceiling: 0.08, creepMs: 8_000 };

export type StageState = "done" | "current" | "pending";

/** What the bar and the stepper show, from the polled status. */
export type Progress = {
  /** Index of the running stage; `STAGES.length` once the trip is ready. */
  stage: number;
  /** Where the bar heads to, from 0 to 1. */
  target: number;
  /** How long the bar takes to get there, in ms. */
  durationMs: number;
};

/** The progress of a generation that has not failed (a failure freezes the bar instead). */
export function progressOf(status: TripStatus | undefined, currentStep: string | null | undefined): Progress {
  if (status === "ready") return { stage: STAGES.length, target: 1, durationMs: 600 };
  const step = (status === "generating" && currentStep ? STEPS[currentStep] : undefined) ?? QUEUED;
  return { stage: STAGES.indexOf(step.stage), target: step.ceiling, durationMs: step.creepMs };
}

export function stageState(index: number, progress: Progress): StageState {
  if (index < progress.stage) return "done";
  if (index === progress.stage) return "current";
  return "pending";
}
