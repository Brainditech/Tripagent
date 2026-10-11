import { describe, expect, it, vi } from "vitest";

import { validItinerary } from "@/server/ai/__fixtures__/itinerary";
import { toUnresolvedContent } from "@/server/ai/schema";
import { firstVersionUpsert } from "@/server/trips/versions";

// A real Drizzle instance over a client that is never used: the test only renders SQL.
vi.mock("@/server/db", async () => {
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  return { db: drizzle({ client: neon("postgresql://user:password@localhost:5432/tripagent") }) };
});

describe("firstVersionUpsert", () => {
  it("survives a retried save step: the (trip, number) conflict updates the content and still returns the id", () => {
    const { sql, params } = firstVersionUpsert("trip-1", toUnresolvedContent(validItinerary)).toSQL();
    expect(sql).toMatch(/^insert into "trip_versions"/);
    expect(sql).toMatch(/on conflict \("trip_id","version_number"\) do update set "content" = \$\d+/);
    expect(sql).toMatch(/returning "id"$/);
    expect(params).toContain("trip-1");
    expect(params).toContain(1);
    expect(params).toContain("generate");
  });
});
