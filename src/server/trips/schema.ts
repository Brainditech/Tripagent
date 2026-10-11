import { z } from "zod";

import { BUDGET_LEVELS, INTERESTS, isoDateToUtc, MAX_TRAVELERS, MAX_TRIP_DAYS, PACES, tripDays } from "@/lib/trip-rules";

const isoDate = z.string().refine((value) => !Number.isNaN(isoDateToUtc(value)), "Expected a YYYY-MM-DD date");

/** Body of POST /api/trips: the fields of the "Nouveau voyage" form. */
export const newTripSchema = z
  .object({
    destination: z.string().trim().min(2).max(120),
    startDate: isoDate,
    endDate: isoDate,
    budget: z.enum(BUDGET_LEVELS),
    travelers: z.number().int().min(1).max(MAX_TRAVELERS),
    interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length),
    pace: z.enum(PACES),
  })
  .superRefine((trip, ctx) => {
    const days = tripDays(trip.startDate, trip.endDate);
    if (days < 1) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "endDate must not be before startDate" });
    } else if (days > MAX_TRIP_DAYS) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: `A trip lasts ${MAX_TRIP_DAYS} days at most` });
    }
  });

export type NewTripInput = z.infer<typeof newTripSchema>;
