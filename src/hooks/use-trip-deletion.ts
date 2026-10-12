import * as Sentry from "@sentry/react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";

import { useApi } from "@/lib/api";
import type { TripsResponse } from "@/lib/trips";

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  title: "Supprimer ce voyage ?",
  message: "L’itinéraire et toutes ses versions seront supprimés. Cette action est définitive.",
  cancel: "Annuler",
  delete: "Supprimer",
  failedTitle: "Suppression impossible",
  failed: "Le voyage n’a pas pu être supprimé. Vérifiez votre connexion et réessayez.",
} as const;

/**
 * Deletes a trip after the native confirmation dialog, from the lists or the detail. DELETE
 * cascades to the versions, messages and jobs; the cached copies go with it and the trip leaves
 * the cached list at once. `deletingId` is the trip being deleted, for a spinner.
 */
export function useTripDeletion({ onDeleted }: { onDeleted?: (id: string) => void } = {}) {
  const api = useApi();
  const queryClient = useQueryClient();

  const deletion = useMutation({
    mutationFn: (id: string) => api.delete(`/api/trips/${id}`),
    onSuccess: (_result, id) => {
      Sentry.logger.info("Trip deleted", { trip_id: id });
      queryClient.removeQueries({ queryKey: ["trip", id] });
      queryClient.removeQueries({ queryKey: ["trip-status", id] });
      queryClient.setQueryData<TripsResponse>(["trips"], (current) =>
        current ? { trips: current.trips.filter((trip) => trip.id !== id) } : current,
      );
      onDeleted?.(id);
    },
    // The API client has logged the refusal.
    onError: () => Alert.alert(TEXTS.failedTitle, TEXTS.failed),
  });

  const confirmDelete = (id: string) => {
    Alert.alert(
      TEXTS.title,
      TEXTS.message,
      [
        { text: TEXTS.cancel, style: "cancel" },
        { text: TEXTS.delete, style: "destructive", onPress: () => deletion.mutate(id) },
      ],
      { cancelable: true },
    );
  };

  return { confirmDelete, deletingId: deletion.isPending ? (deletion.variables ?? null) : null };
}
