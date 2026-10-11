import { describe, expect, it, vi } from "vitest";

import { HttpError } from "@/server/http";
import { assertTripQuota, monthStartUtc } from "@/server/trips/quota";

// The quota module imports the database client, which needs DATABASE_URL at import time
// (`vi.mock` is hoisted above the imports by Vitest).
vi.mock("@/server/db", () => ({ db: {} }));

describe("monthStartUtc", () => {
  it("returns the first instant of the UTC month", () => {
    expect(monthStartUtc(new Date("2026-10-11T23:30:00+02:00")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("follows UTC, not the local calendar", () => {
    // 1 November 01:00 in Paris is still 31 October in UTC: the quota month is October.
    expect(monthStartUtc(new Date("2026-11-01T01:00:00+02:00")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(monthStartUtc(new Date("2026-11-01T00:00:00Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });
});

describe("assertTripQuota", () => {
  it("lets a user under the limit through", () => {
    expect(() => assertTripQuota(0, 3)).not.toThrow();
    expect(() => assertTripQuota(2, 3)).not.toThrow();
  });

  it("answers 429 once the limit is reached", () => {
    let caught: unknown;
    try {
      assertTripQuota(3, 3);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(HttpError);
    expect((caught as HttpError).status).toBe(429);
    expect((caught as HttpError).code).toBe("quota_exceeded");
    expect(() => assertTripQuota(7, 3)).toThrow(HttpError);
  });
});
