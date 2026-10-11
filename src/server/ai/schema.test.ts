import { describe, expect, it } from "vitest";

import { validItinerary } from "@/server/ai/__fixtures__/itinerary";
import { itinerarySchema, itineraryToolSchema, toUnresolvedContent, tripContentSchema } from "@/server/ai/schema";

describe("itinerarySchema", () => {
  it("accepts a complete itinerary", () => {
    expect(itinerarySchema.safeParse(validItinerary).success).toBe(true);
  });

  it("rejects an itinerary without days", () => {
    const result = itinerarySchema.safeParse({ ...validItinerary, days: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown time of day", () => {
    const day = validItinerary.days[0];
    const broken = { ...day, activities: [{ ...day.activities[0], timeOfDay: "night" }] };
    expect(itinerarySchema.safeParse({ ...validItinerary, days: [broken] }).success).toBe(false);
  });

  it("still enforces the constraints removed from the tool schema", () => {
    // `minimum: 0` is stripped for Claude's strict mode but Zod keeps checking it.
    const day = validItinerary.days[0];
    const broken = { ...day, activities: [{ ...day.activities[0], estimatedCost: -5 }] };
    expect(itinerarySchema.safeParse({ ...validItinerary, days: [broken] }).success).toBe(false);
    expect(itinerarySchema.safeParse({ ...validItinerary, currency: "EURO" }).success).toBe(false);
  });
});

describe("itineraryToolSchema", () => {
  const unsupported = ["minimum", "maximum", "multipleOf", "minLength", "maxLength", "maxItems", "$schema"];

  /** Every object node of a JSON Schema, depth first. */
  function* nodes(node: unknown): Generator<Record<string, unknown>> {
    if (typeof node !== "object" || node === null) return;
    if (Array.isArray(node)) {
      for (const item of node) yield* nodes(item);
      return;
    }
    const record = node as Record<string, unknown>;
    yield record;
    for (const value of Object.values(record)) yield* nodes(value);
  }

  it("only uses what Claude's strict tool use accepts", () => {
    for (const node of nodes(itineraryToolSchema)) {
      for (const keyword of unsupported) expect(node).not.toHaveProperty(keyword);
      if (typeof node.minItems === "number") expect(node.minItems).toBeLessThanOrEqual(1);
      if (node.type === "object") {
        expect(node.additionalProperties).toBe(false);
        expect(Array.isArray(node.required)).toBe(true);
      }
    }
  });

  it("describes the whole itinerary", () => {
    const properties = itineraryToolSchema.properties as Record<string, unknown>;
    expect(Object.keys(properties).sort()).toEqual(["budget", "currency", "days", "hotels", "summary", "tips", "title"]);
    expect(itineraryToolSchema.required).toEqual(Object.keys(properties));
  });
});

describe("toUnresolvedContent", () => {
  it("keeps every place query and marks it unresolved", () => {
    const content = toUnresolvedContent(validItinerary);
    expect(tripContentSchema.safeParse(content).success).toBe(true);
    const places = [...content.days.flatMap((day) => day.activities.map((a) => a.place)), ...content.hotels.map((h) => h.place)];
    expect(places).toHaveLength(3);
    for (const place of places) {
      expect(place.placeId).toBeNull();
      expect(place.resolved).toBe(false);
      expect(place.query.length).toBeGreaterThan(0);
    }
  });
});
