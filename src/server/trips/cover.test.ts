import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { customCoverSwap } from "@/server/trips/cover";

// The statement is only rendered here: the database module must not open a connection.
vi.mock("@/server/db", () => ({ db: {} }));

describe("customCoverSwap", () => {
  it("writes the cover and returns the displaced one in a single statement", () => {
    const cover = { fileId: "file_2", filePath: "/tripagent/covers/user_1/trip_1/cover_2.jpg" };
    const { sql, params } = new PgDialect().sqlToQuery(customCoverSwap("trip_1", cover));
    expect(sql).toMatch(/^\s*update "trips"/);
    expect(sql).toMatch(/set cover_custom = \$1::jsonb, updated_at = now\(\)/);
    expect(sql).toMatch(/where "trips"\."id" = \$2/);
    expect(sql).toMatch(/returning old\.cover_custom as previous\s*$/);
    expect(params).toEqual([JSON.stringify(cover), "trip_1"]);
  });
});
