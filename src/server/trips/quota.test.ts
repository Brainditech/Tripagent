import { describe, expect, it, vi } from "vitest";

import { HttpError } from "@/server/http";
import { monthStartUtc, quotaMonth, reserveTripQuota, tripQuotaReservation } from "@/server/trips/quota";

// A real Drizzle instance over a client that is never used: the tests only render SQL.
vi.mock("@/server/db", async () => {
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  return { db: drizzle({ client: neon("postgresql://user:password@localhost:5432/tripagent") }) };
});

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

describe("quotaMonth", () => {
  it("keys the quota row by the first day of the UTC month", () => {
    expect(quotaMonth(new Date("2026-10-11T23:30:00+02:00"))).toBe("2026-10-01");
    expect(quotaMonth(new Date("2026-11-01T01:00:00+02:00"))).toBe("2026-10-01");
  });
});

describe("tripQuotaReservation", () => {
  it("reserves a slot in one upsert that only adds while the count is under the limit", () => {
    const { sql, params } = tripQuotaReservation("user_1", 3, "2026-10-01").toSQL();
    expect(sql).toMatch(/^insert into "monthly_generations"/);
    expect(sql).toMatch(/on conflict \("user_id","month"\) do update set/);
    expect(sql).toMatch(/"used" = "monthly_generations"\."used" \+ 1/);
    expect(sql).toMatch(/where "monthly_generations"\."used" < \$\d+/);
    expect(sql).toMatch(/returning "used"$/);
    expect(params).toContain("user_1");
    expect(params).toContain("2026-10-01");
    expect(params).toContain(3);
  });
});

describe("reserveTripQuota", () => {
  it("answers 429 without a query when the limit is zero", async () => {
    let caught: unknown;
    try {
      await reserveTripQuota("user_1", 0, "2026-10-01");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(HttpError);
    expect((caught as HttpError).status).toBe(429);
    expect((caught as HttpError).code).toBe("quota_exceeded");
  });
});
