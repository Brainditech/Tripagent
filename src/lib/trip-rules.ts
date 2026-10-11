// Rules shared by the "Nouveau voyage" form and the server validation of POST /api/trips.
// This file has no dependency, so the server can import it without pulling client code.

/** A trip covers 1 to 10 calendar days (PLAN.md). */
export const MAX_TRIP_DAYS = 10;
export const MAX_TRAVELERS = 10;

export const BUDGET_LEVELS = ["budget", "comfort", "luxury"] as const;
export type BudgetLevel = (typeof BUDGET_LEVELS)[number];

export const PACES = ["relaxed", "balanced", "intense"] as const;
export type Pace = (typeof PACES)[number];

export const INTERESTS = [
  "adventure",
  "beaches",
  "food",
  "culture",
  "nature",
  "nightlife",
  "shopping",
  "history",
  "relaxation",
  "road-trips",
] as const;
export type Interest = (typeof INTERESTS)[number];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Milliseconds since the epoch of a `YYYY-MM-DD` calendar day at UTC midnight, or NaN. */
export function isoDateToUtc(value: string): number {
  const match = ISO_DATE.exec(value);
  if (!match) return NaN;
  const [year, month, day] = match.slice(1).map(Number);
  const time = Date.UTC(year, month - 1, day);
  const check = new Date(time);
  // Rejects impossible days such as 2026-02-30, which Date.UTC would silently roll over.
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day ? time : NaN;
}

/** Number of calendar days covered by two `YYYY-MM-DD` dates, inclusive (1 when equal). */
export function tripDays(startDate: string, endDate: string): number {
  return Math.round((isoDateToUtc(endDate) - isoDateToUtc(startDate)) / 86_400_000) + 1;
}

/** `YYYY-MM-DD` of a local calendar day, without any time zone shift. */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
