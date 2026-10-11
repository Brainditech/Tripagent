import { z } from "zod";

// Shape of a trip's content: what Claude produces (`itinerarySchema`, places as a query only)
// and what is stored in `trip_versions.content` (`tripContentSchema`, places with their
// resolution). The JSON Schema of Claude's tool is derived from the first one.

/** A place as Claude names it. Google Places resolves it later, from this query. */
const placeQuerySchema = z.object({
  query: z
    .string()
    .describe("Full searchable name of the place with its city and country, e.g. 'Senso-ji Temple, Asakusa, Tokyo, Japan'"),
});

/** A stored place: the query, plus the Google `placeId` once resolved. Nothing else is persisted. */
const placeSchema = placeQuerySchema.extend({
  placeId: z.string().nullable(),
  /** False when the place was not looked up or was not found: shown without map or photo. */
  resolved: z.boolean(),
});

const amount = z.number().min(0);

function contentSchema<P extends z.ZodType>(place: P) {
  return z.object({
    title: z.string().min(1).describe("Short trip title in the requested language, e.g. '5 jours à Istanbul'"),
    summary: z.string().min(1).describe("Two or three sentences presenting the trip"),
    currency: z.string().length(3).describe("ISO 4217 code of the destination's currency, used for every amount"),
    days: z
      .array(
        z.object({
          dayNumber: z.number().int().min(1),
          date: z.string().describe("YYYY-MM-DD"),
          title: z.string().min(1).describe("Theme of the day"),
          activities: z
            .array(
              z.object({
                timeOfDay: z.enum(["morning", "afternoon", "evening"]),
                name: z.string().min(1),
                description: z
                  .string()
                  .min(1)
                  .describe("What to do there and why it fits the travellers, 2 to 3 sentences"),
                durationMinutes: z.number().int().min(0),
                estimatedCost: amount.describe("Per person, 0 when free"),
                place,
              }),
            )
            .min(1),
        }),
      )
      .min(1),
    hotels: z
      .array(
        z.object({
          name: z.string().min(1),
          description: z.string().min(1).describe("Why this hotel suits the budget and the itinerary, 1 to 2 sentences"),
          pricePerNight: amount.describe("For the whole party, per night"),
          place,
        }),
      )
      .min(1),
    budget: z.object({
      perPerson: z.object({
        accommodation: amount,
        food: amount,
        activities: amount,
        transport: amount,
        total: amount.describe("Sum of the four categories"),
      }),
      notes: z.string().describe("How the estimate was made and how to spend less"),
    }),
    tips: z.array(z.string().min(1)).min(1).describe("Practical advice: transport, etiquette, safety, booking"),
  });
}

/** What Claude returns through the `save_itinerary` tool. */
export const itinerarySchema = contentSchema(placeQuerySchema);
export type Itinerary = z.infer<typeof itinerarySchema>;

/** What `trip_versions.content` holds. */
export const tripContentSchema = contentSchema(placeSchema);
export type TripContent = z.infer<typeof tripContentSchema>;

/**
 * The stored content before any place is looked up. Google Places is deferred to
 * the detail screen, so for now every place stays unresolved and is shown without
 * map or photo, as PLAN.md already provides for an unknown place.
 */
export function toUnresolvedContent(itinerary: Itinerary): TripContent {
  const unresolved = (place: { query: string }) => ({ query: place.query, placeId: null, resolved: false });
  return {
    ...itinerary,
    days: itinerary.days.map((day) => ({
      ...day,
      activities: day.activities.map((activity) => ({ ...activity, place: unresolved(activity.place) })),
    })),
    hotels: itinerary.hotels.map((hotel) => ({ ...hotel, place: unresolved(hotel.place) })),
  };
}

/**
 * Keywords that Claude's strict mode rejects with a 400. Zod keeps enforcing them when
 * the tool input is validated with `itinerarySchema`, so nothing is lost.
 */
const UNSUPPORTED_IN_STRICT_MODE = ["minimum", "maximum", "multipleOf", "minLength", "maxLength", "maxItems"];

/** JSON Schema of a Zod schema, reduced to what Claude's strict tool use accepts. */
export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, {
    override: ({ jsonSchema }) => {
      const node = jsonSchema as Record<string, unknown>;
      for (const keyword of UNSUPPORTED_IN_STRICT_MODE) delete node[keyword];
      // Strict mode only knows minItems 0 and 1.
      if (typeof node.minItems === "number" && node.minItems > 1) node.minItems = 1;
    },
  }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/** `input_schema` of the `save_itinerary` tool. */
export const itineraryToolSchema = toStrictJsonSchema(itinerarySchema);
