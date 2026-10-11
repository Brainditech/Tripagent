import { z } from "zod";

/** Model behind every Claude call (PLAN.md: Haiku 4.5). `ANTHROPIC_MODEL` in `.env` overrides it. */
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

/** `.env` lists unused variables as `NAME=`: an empty value counts as unset, so defaults apply. */
const emptyAsUndefined = (value: unknown) => (value === "" ? undefined : value);
const positiveInt = (fallback: number) =>
  z.preprocess(
    (value) => (value === undefined || value === "" ? undefined : Number(value)),
    z.number().int().min(1).default(fallback),
  );

const configSchema = z.object({
  ANTHROPIC_MODEL: z.preprocess(emptyAsUndefined, z.string().default(DEFAULT_MODEL)),
  /** Trips a user may generate per calendar month (UTC). Prudent defaults; `.env` raises them in development. */
  QUOTA_TRIPS_PER_MONTH: positiveInt(3),
  /** Chat adjustments allowed on one trip. */
  QUOTA_ADJUSTMENTS_PER_TRIP: positiveInt(5),
});

const parsed = configSchema.parse({
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
  QUOTA_TRIPS_PER_MONTH: process.env.QUOTA_TRIPS_PER_MONTH,
  QUOTA_ADJUSTMENTS_PER_TRIP: process.env.QUOTA_ADJUSTMENTS_PER_TRIP,
});

/** Non-secret server settings, validated once at startup. */
export const config = {
  aiModel: parsed.ANTHROPIC_MODEL,
  quotas: {
    tripsPerMonth: parsed.QUOTA_TRIPS_PER_MONTH,
    adjustmentsPerTrip: parsed.QUOTA_ADJUSTMENTS_PER_TRIP,
  },
} as const;

// Static accesses only: Expo's lint forbids `process.env[name]`, which Metro could not inline.
const secrets = {
  ANTHROPIC_API_KEY: () => process.env.ANTHROPIC_API_KEY,
  UNSPLASH_ACCESS_KEY: () => process.env.UNSPLASH_ACCESS_KEY,
  CLERK_SECRET_KEY: () => process.env.CLERK_SECRET_KEY,
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: () => process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  IMAGEKIT_PRIVATE_KEY: () => process.env.IMAGEKIT_PRIVATE_KEY,
  // The ImageKit public key and URL endpoint are not secret, but they are server settings read the same way.
  IMAGEKIT_PUBLIC_KEY: () => process.env.IMAGEKIT_PUBLIC_KEY,
  IMAGEKIT_URL_ENDPOINT: () => process.env.IMAGEKIT_URL_ENDPOINT,
} as const;

/**
 * A secret read when it is first needed, so that a route which does not use it
 * still works while `.env` is incomplete. Never logged, never sent to the client.
 */
export function requireEnv(name: keyof typeof secrets): string {
  const value = secrets[name]();
  if (!value) throw new Error(`${name} is not set: add it to .env (see .env.example).`);
  return value;
}
