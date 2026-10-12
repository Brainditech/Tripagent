import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HOME_ACCENT, type Inspiration, InspirationCard, ListMessage, TripCard } from "@/components/home-ui";
import { ArrowRightIcon, BellIcon, GearIcon, SparkleIcon } from "@/components/icons";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { useTripDeletion } from "@/hooks/use-trip-deletion";
import { useApi } from "@/lib/api";
import { tripHref, tripsQueryOptions } from "@/lib/trips";

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  greeting: "Bonjour de nouveau,",
  question: "Où irez-vous ensuite ?",
  settings: "Réglages",
  notifications: "Notifications",
  plannerLabel: "Planificateur IA",
  plannerTitle: "Planifiez votre\nprochain voyage",
  plannerSubtitle: "Dites-nous où, combien de temps et avec qui,\non s’occupe du reste !",
  newTrip: "Nouveau voyage",
  yourTrips: "Vos voyages",
  myTrips: "Mes voyages",
  seeAll: "Voir tout",
  empty: "Aucun voyage pour l’instant. Créez le premier avec « Nouveau voyage ».",
  unreachable: "Impossible de charger vos voyages. Vérifiez votre connexion.",
  retry: "Réessayer",
  inspiration: "Inspiration de voyage",
} as const;

// Hard-coded until api/me feeds the screen (Phase 6).
const USER = { firstName: "Brainditech", avatar: require("@/assets/images/avatar-placeholder.jpg") };
const INSPIRATIONS: Inspiration[] = [
  { id: "bali", title: "Plages de Bali", subtitle: "Détente & Nature", cover: require("@/assets/images/inspiration-bali.jpg") },
  { id: "kyoto", title: "Aventure à Kyoto", subtitle: "Culture & Cuisine", cover: require("@/assets/images/inspiration-kyoto.jpg") },
  { id: "rome", title: "Escapade à Rome", subtitle: "Art & Histoire", cover: require("@/assets/images/inspiration-rome.jpg") },
  { id: "bora-bora", title: "Bora Bora", subtitle: "Lagon & Farniente", cover: require("@/assets/images/trip-bora-bora.jpg") },
  { id: "cinque-terre", title: "Cinque Terre", subtitle: "Villages & Mer", cover: require("@/assets/images/trip-cinque-terre.jpg") },
];

/** The home shows the latest trips; the Voyages tab has them all. */
const HOME_TRIPS = 3;

const ACCENT = HOME_ACCENT;
const BUTTON_SHADOW = { boxShadow: "0 3px 10px rgba(5, 30, 60, 0.22)" } as const;

// Sizes follow design/home-screen-ui-design.jpg: 1 reference px = 0.708 dp.
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const api = useApi();

  // The user's trips, read again when the screen comes back (a generation may have ended) and on pull.
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
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 28, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            colors={[ACCENT]}
            tintColor={ACCENT}
            progressViewOffset={insets.top}
          />
        }
      >
        {/* Avatar, greeting and the settings / notifications buttons. */}
        <View className="mx-[17px] h-[50px] flex-row items-center">
          <Pressable accessibilityRole="button" className="h-[50px] w-[50px] overflow-hidden rounded-full bg-[#E6E8EE]">
            <Image source={USER.avatar} className="h-full w-full" contentFit="cover" />
          </Pressable>
          <View className="ml-[12px] flex-1">
            <View className="flex-row items-center">
              <Text numberOfLines={1} className="shrink font-sans text-[14px] leading-[20px] text-[#111111]">
                {TEXTS.greeting} {USER.firstName}
                {" !"}
              </Text>
              <Text className="ml-[4px] text-[13px] leading-[20px]">👋</Text>
            </View>
            <Text numberOfLines={1} className="mt-[1px] font-sans-bold text-[21.5px] leading-[26px] text-[#111111]">
              {TEXTS.question}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={TEXTS.settings}
            className="h-[36px] w-[36px] items-center justify-center"
          >
            <GearIcon width={21} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={TEXTS.notifications}
            className="-mr-[8px] h-[36px] w-[36px] items-center justify-center"
          >
            <BellIcon width={20} />
          </Pressable>
        </View>

        {/* "Planificateur IA" card; the button sits astride its bottom edge. */}
        <View className="mx-[12px] mt-[21px] pb-[19px]">
          <View className="h-[187px] overflow-hidden rounded-[16px] bg-[#0E4A6B]">
            <Image
              source={require("@/assets/images/home-hero.jpg")}
              className="absolute left-0 top-0 h-full w-full"
              contentFit="cover"
            />
            <View className="absolute left-[27px] top-[23px] flex-row items-center">
              <SparkleIcon width={18} />
              <Text className="ml-[7px] font-sans text-[15px] leading-[19px] text-white">{TEXTS.plannerLabel}</Text>
            </View>
            <Text className="absolute left-[27px] top-[57px] font-sans-bold text-[24.5px] leading-[28.5px] text-white">
              {TEXTS.plannerTitle}
            </Text>
            <Text className="absolute left-[27px] top-[121px] font-sans text-[14.5px] leading-[16px] text-white">
              {TEXTS.plannerSubtitle}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/new-trip")}
            className="absolute bottom-0 left-[27px] h-[38px] w-[197px] flex-row items-center justify-center rounded-full bg-white"
            style={BUTTON_SHADOW}
          >
            <Text className="font-sans-bold text-[15.5px] leading-[19px]" style={{ color: ACCENT }}>
              {TEXTS.newTrip}
            </Text>
            <View className="ml-[11px]">
              <ArrowRightIcon width={15} color={ACCENT} />
            </View>
          </Pressable>
        </View>

        {/* The latest trips; the count is the whole list's, which the Voyages tab shows. */}
        <Text className="mx-[17px] mt-[7px] font-sans-bold text-[17.7px] leading-[22px] text-[#111111]">
          {TEXTS.yourTrips}
        </Text>
        <View className="mx-[17px] mt-[6px] flex-row items-center">
          <Text className="flex-1 font-sans text-[15.7px] leading-[20px] text-[#111111]">
            {TEXTS.myTrips}
            {tripsQuery.data ? ` (${trips.length})` : ""}
          </Text>
          {trips.length > HOME_TRIPS ? (
            <Pressable accessibilityRole="link" onPress={() => router.navigate("/trips")} hitSlop={8}>
              <Text className="font-sans-medium text-[13.5px] leading-[20px]" style={{ color: ACCENT }}>
                {TEXTS.seeAll}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View className="mt-[10px] gap-[12px]">
          {tripsQuery.isPending ? (
            <View className="items-center py-[24px]">
              <ActivityIndicator color={ACCENT} />
            </View>
          ) : tripsQuery.isError ? (
            <ListMessage text={TEXTS.unreachable} action={TEXTS.retry} onAction={() => void tripsQuery.refetch()} />
          ) : trips.length === 0 ? (
            <ListMessage text={TEXTS.empty} />
          ) : (
            trips
              .slice(0, HOME_TRIPS)
              .map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onPress={() => router.push(tripHref(trip))}
                  onLongPress={() => confirmDelete(trip.id)}
                  deleting={deletingId === trip.id}
                />
              ))
          )}
        </View>

        {/* Destination ideas, scrolled sideways. */}
        <Text className="mx-[17px] mt-[16px] font-sans-bold text-[17.7px] leading-[22px] text-[#111111]">
          {TEXTS.inspiration}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-[10px]"
          contentContainerClassName="gap-[7px] px-[17px]"
        >
          {INSPIRATIONS.map((item) => (
            <InspirationCard key={item.id} item={item} />
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
}
