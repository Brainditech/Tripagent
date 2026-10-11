import { describe, expect, it } from "vitest";

import { tripDays } from "@/lib/trip-rules";
import { newTripSchema } from "@/server/trips/schema";

const valid = {
  destination: "Tokyo, Japon",
  startDate: "2026-11-02",
  endDate: "2026-11-05",
  budget: "comfort",
  travelers: 2,
  interests: ["food", "culture"],
  pace: "balanced",
};

describe("newTripSchema", () => {
  it("accepts the form as the app sends it", () => {
    const result = newTripSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts a single day and exactly ten days", () => {
    expect(newTripSchema.safeParse({ ...valid, endDate: "2026-11-02" }).success).toBe(true);
    expect(newTripSchema.safeParse({ ...valid, endDate: "2026-11-11" }).success).toBe(true);
    expect(tripDays("2026-11-02", "2026-11-11")).toBe(10);
  });

  it("refuses more than ten days", () => {
    const result = newTripSchema.safeParse({ ...valid, endDate: "2026-11-12" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["endDate"]);
  });

  it("refuses an end before the start", () => {
    expect(newTripSchema.safeParse({ ...valid, endDate: "2026-11-01" }).success).toBe(false);
  });

  it("refuses a date that does not exist or is not ISO", () => {
    expect(newTripSchema.safeParse({ ...valid, startDate: "2026-02-30", endDate: "2026-03-02" }).success).toBe(false);
    expect(newTripSchema.safeParse({ ...valid, startDate: "02/11/2026" }).success).toBe(false);
  });

  it("bounds travellers to 1..10 and interests to the known list", () => {
    expect(newTripSchema.safeParse({ ...valid, travelers: 0 }).success).toBe(false);
    expect(newTripSchema.safeParse({ ...valid, travelers: 11 }).success).toBe(false);
    expect(newTripSchema.safeParse({ ...valid, travelers: 2.5 }).success).toBe(false);
    expect(newTripSchema.safeParse({ ...valid, interests: ["skiing"] }).success).toBe(false);
    expect(newTripSchema.safeParse({ ...valid, budget: "cheap" }).success).toBe(false);
  });

  it("trims the destination and refuses an empty one", () => {
    const result = newTripSchema.safeParse({ ...valid, destination: "  Rome  " });
    expect(result.success && result.data.destination).toBe("Rome");
    expect(newTripSchema.safeParse({ ...valid, destination: " " }).success).toBe(false);
  });
});
