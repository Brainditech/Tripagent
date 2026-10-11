import type { Itinerary } from "@/server/ai/schema";

const place = (query: string) => ({ query });

/** A short but complete itinerary, as Claude's `save_itinerary` tool returns it. */
export const validItinerary: Itinerary = {
  title: "4 jours à Tokyo",
  summary: "Quatre jours entre temples d'Asakusa, ruelles de Shimokitazawa et sushis de Tsukiji.",
  currency: "JPY",
  days: [
    {
      dayNumber: 1,
      date: "2026-11-02",
      title: "Asakusa et la Sumida",
      activities: [
        {
          timeOfDay: "morning",
          name: "Senso-ji",
          description: "Le plus ancien temple de Tokyo, à voir tôt avant la foule. L'allée Nakamise sert de petit-déjeuner.",
          durationMinutes: 90,
          estimatedCost: 0,
          place: place("Senso-ji Temple, Asakusa, Tokyo, Japan"),
        },
        {
          timeOfDay: "afternoon",
          name: "Croisière sur la Sumida",
          description: "Bateau d'Asakusa à Hamarikyu, puis les jardins au bord de la baie.",
          durationMinutes: 120,
          estimatedCost: 1200,
          place: place("Hamarikyu Gardens, Chuo, Tokyo, Japan"),
        },
      ],
    },
  ],
  hotels: [
    {
      name: "Hotel Gracery Asakusa",
      description: "Hôtel de milieu de gamme à cinq minutes du temple, bien desservi par la ligne Ginza.",
      pricePerNight: 18000,
      place: place("Hotel Gracery Asakusa, Tokyo, Japan"),
    },
  ],
  budget: {
    perPerson: { accommodation: 36000, food: 16000, activities: 6000, transport: 4000, total: 62000 },
    notes: "Estimation pour deux personnes partageant la chambre ; les repas mélangent izakaya et petits restaurants.",
  },
  tips: ["Prenez une carte Suica dès l'aéroport.", "Les temples ouvrent tôt : commencez vos journées à 8 h."],
};
