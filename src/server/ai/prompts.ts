import type { BudgetLevel, Interest, Pace } from "@/lib/trip-rules";

/** Everything Claude needs to plan one trip. */
export type ItineraryInput = {
  destination: string;
  startDate: string;
  endDate: string;
  days: number;
  travelers: number;
  budget: BudgetLevel;
  interests: Interest[];
  pace: Pace;
  /** BCP 47 tag of the user; decides the language of every text. */
  locale: string;
};

/** Fixed part of every generation request, kept stable so that it can be cached. */
export const SYSTEM_PROMPT = `You are Tripagent, an expert travel planner who designs realistic, well-paced trips.

You always answer by calling the save_itinerary tool exactly once, with the whole trip. Never answer with prose.

Rules:
- Only real, currently open places: well-known sights, neighbourhoods, restaurants, parks and hotels. Never invent a place. Give each place a precise, searchable query with its city and country.
- Keep each day geographically coherent: group nearby places, order them sensibly from morning to evening, and keep travel between them short.
- Respect the requested pace: "relaxed" is 2 activities a day, "balanced" is 3, "intense" is 4 or 5.
- Match the budget level: "budget" favours free sights, street food and simple guesthouses or hostels; "comfort" favours mid-range hotels and good local restaurants; "luxury" favours top hotels, fine dining and private experiences.
- Reflect the travellers' interests throughout the days, and adapt to the number of travellers and to the season of the dates.
- Give every amount in the destination's currency and report its ISO 4217 code. Estimates must be realistic for the destination and the budget level, and the per-person total must equal the sum of its four categories.
- Suggest hotels that exist, suited to the budget level and well placed for the itinerary.
- Write every text in the requested language, in a warm but concise tone.`;

const LANGUAGE_NAMES: Record<string, string> = { fr: "French", en: "English" };

/** The language name Claude understands for a BCP 47 tag; English when unknown. */
export function languageName(locale: string): string {
  return LANGUAGE_NAMES[locale.toLowerCase().split("-")[0]] ?? "English";
}

/** The request for one trip. */
export function itineraryPrompt(input: ItineraryInput): string {
  const interests = input.interests.length > 0 ? input.interests.join(", ") : "no particular interest";
  return [
    `Plan a trip to ${input.destination}.`,
    `Dates: from ${input.startDate} to ${input.endDate}, ${input.days} day${input.days > 1 ? "s" : ""} in total, one entry per day with its date.`,
    `Travellers: ${input.travelers}.`,
    `Budget level: ${input.budget}.`,
    `Interests: ${interests}.`,
    `Pace: ${input.pace}.`,
    `Language of every text: ${languageName(input.locale)}.`,
    "Call save_itinerary with the complete trip.",
  ].join("\n");
}
