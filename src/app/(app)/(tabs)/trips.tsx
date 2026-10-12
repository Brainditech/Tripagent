import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/buttons";
import { HOME_ACCENT, ListMessage, TripCard } from "@/components/home-ui";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { useTripDeletion } from "@/hooks/use-trip-deletion";
import { useApi } from "@/lib/api";
import { tripHref, tripsQueryOptions } from "@/lib/trips";

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  title: "Mes voyages",
  count: (n: number) => `${n} voyage${n > 1 ? "s" : ""}`,
  hint: "Appuyez longuement sur un voyage pour le supprimer.",
  emptyTitle: "Aucun voyage pour l’instant",
  empty: "Dites-nous où, combien de temps et avec qui, on s’occupe du reste !",
  newTrip: "Nouveau voyage",
  unreachable: "Impossible de charger vos voyages. Vérifiez votre connexion.",
  retry: "Réessayer",
} as const;

/**
 * Every trip of the user, newest first, with the same cards as the home: a tap opens the trip
 * (its progress while it is generated), a long press deletes it after a confirmation. Pulled
 * down to read again; read again as well when the tab comes back into view.
 */
export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const api = useApi();

  const tripsQuery = useQuery(tripsQueryOptions(api));
  useRefreshOnFocus(tripsQuery.refetch);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await tripsQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };
  const { confirmDelete, deletingId } = useTripDeletion();
  const trips = tripsQuery.data?.trips ?? [];

  return (
    <View className="flex-1 bg-[#F9F9FB]">
      <StatusBar style="dark" />
      <FlatList
        data={trips}
        keyExtractor={(trip) => trip.id}
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            onPress={() => router.push(tripHref(item))}
            onLongPress={() => confirmDelete(item.id)}
            deleting={deletingId === item.id}
          />
        )}
        contentContainerStyle={{ paddingTop: insets.top + 28, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            colors={[HOME_ACCENT]}
            tintColor={HOME_ACCENT}
            progressViewOffset={insets.top}
          />
        }
        ListHeaderComponent={
          <View className="mx-[17px]">
            <Text className="font-sans-bold text-[21.5px] leading-[26px] text-[#111111]">{TEXTS.title}</Text>
            <Text className="mt-[2px] min-h-[20px] font-sans text-[14px] leading-[20px] text-[#5B6578]">
              {tripsQuery.data && trips.length > 0 ? TEXTS.count(trips.length) : ""}
            </Text>
          </View>
        }
        ListEmptyComponent={
          tripsQuery.isPending ? (
            <View className="items-center py-[24px]">
              <ActivityIndicator color={HOME_ACCENT} />
            </View>
          ) : tripsQuery.isError ? (
            <ListMessage text={TEXTS.unreachable} action={TEXTS.retry} onAction={() => void tripsQuery.refetch()} />
          ) : (
            <View className="mx-[17px] mt-[24px] items-center">
              <Text className="text-center font-sans-bold text-[17px] leading-[22px] text-[#111111]">{TEXTS.emptyTitle}</Text>
              <Text className="mt-[6px] text-center font-sans text-[14px] leading-[20px] text-[#5B6578]">{TEXTS.empty}</Text>
              <View className="mt-[20px] w-full">
                <PrimaryButton label={TEXTS.newTrip} onPress={() => router.push("/new-trip")} />
              </View>
            </View>
          )
        }
        ListFooterComponent={
          trips.length > 0 ? (
            <Text className="mx-[17px] mt-[4px] text-center font-sans text-[12.5px] leading-[17px] text-[#8A94A6]">{TEXTS.hint}</Text>
          ) : null
        }
      />
    </View>
  );
}
