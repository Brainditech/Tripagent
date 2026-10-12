import { queryOptions } from "@tanstack/react-query";

import type { Api } from "@/lib/api";

/** Answer of `GET /api/me`: the profile as the server holds it, and the monthly quota. */
export type MeResponse = {
  id: string;
  email: string;
  name: string | null;
  locale: string;
  quotas: {
    tripsPerMonth: number;
    tripsUsedThisMonth: number;
    tripsRemaining: number;
    adjustmentsPerTrip: number;
  };
};

/** The signed-in user's profile and quota; read again when the Profil tab comes back into view. */
export function meQueryOptions(api: Api) {
  return queryOptions({
    queryKey: ["me"],
    queryFn: () => api.get<MeResponse>("/api/me"),
  });
}
