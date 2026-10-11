import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArrowRightIcon, BellIcon, GearIcon, SparkleIcon } from "@/components/icons";
import { type Inspiration, InspirationCard, type Trip, TripCard } from "@/components/home-ui";

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  greeting: "Bonjour de nouveau,",
  question: "Où irez-vous ensuite ?",
  settings: "Réglages",
  notifications: "Notifications",
  plannerLabel: "Planificateur IA",
  plannerTitle: "Planifiez votre\nprochain voyage",
  plannerSubtitle: "Dites-nous où, combien de temps et avec qui,\non s’occupe du reste !",
  newTrip: "Nouveau voyage",
  yourTrips: "Vos voyages",
  myTrips: "Mes voyages",
  inspiration: "Inspiration de voyage",
} as const;

// Hard-coded data until Phase 4 (api/me, api/trips) feeds the screen.
const USER = { firstName: "Brainditech", avatar: require("@/assets/images/avatar-placeholder.jpg") };
const TRIPS: Trip[] = [
  {
    id: "istanbul",
    title: "5 jours à Istanbul, Turquie",
    location: "Istanbul, Turquie",
    days: 5,
    costPerPerson: 525,
    cover: require("@/assets/images/trip-istanbul.jpg"),
  },
  {
    id: "cappadoce",
    title: "4 jours en Cappadoce (Montgolfières)",
    location: "Göreme, Turquie",
    days: 4,
    costPerPerson: 530,
    cover: require("@/assets/images/trip-cappadoce.jpg"),
  },
  {
    id: "kyoto",
    title: "5 jours à Kyoto, Japon",
    location: "Kyoto, Japon",
    days: 5,
    costPerPerson: 980,
    cover: require("@/assets/images/trip-kyoto.jpg"),
  },
];
const INSPIRATIONS: Inspiration[] = [
  { id: "bali", title: "Plages de Bali", subtitle: "Détente & Nature", cover: require("@/assets/images/inspiration-bali.jpg") },
  { id: "kyoto", title: "Aventure à Kyoto", subtitle: "Culture & Cuisine", cover: require("@/assets/images/inspiration-kyoto.jpg") },
  { id: "rome", title: "Escapade à Rome", subtitle: "Art & Histoire", cover: require("@/assets/images/inspiration-rome.jpg") },
  { id: "bora-bora", title: "Bora Bora", subtitle: "Lagon & Farniente", cover: require("@/assets/images/trip-bora-bora.jpg") },
  { id: "cinque-terre", title: "Cinque Terre", subtitle: "Villages & Mer", cover: require("@/assets/images/trip-cinque-terre.jpg") },
];

const ACCENT = "#1C4C82";
const BUTTON_SHADOW = { boxShadow: "0 3px 10px rgba(5, 30, 60, 0.22)" } as const;

// Sizes follow design/home-screen-ui-design.jpg: 1 reference px = 0.708 dp.
export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-[#F9F9FB]">
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 28, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
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
                {" !"}
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

        {/* Trips of the month. */}
        <Text className="mx-[17px] mt-[7px] font-sans-bold text-[17.7px] leading-[22px] text-[#111111]">
          {TEXTS.yourTrips}
        </Text>
        <Text className="mx-[17px] mt-[6px] font-sans text-[15.7px] leading-[20px] text-[#111111]">
          {TEXTS.myTrips} ({TRIPS.length})
        </Text>
        <View className="mt-[10px] gap-[12px]">
          {TRIPS.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
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
