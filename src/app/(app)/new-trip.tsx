import * as Sentry from "@sentry/react-native";
import { useMutation } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CalendarIcon,
  ChevronLeftIcon,
  DiamondIcon,
  PeopleIcon,
  PinIcon,
  SeatIcon,
  SparkleIcon,
  WalletIcon,
} from "@/components/icons";
import {
  Calendar,
  Chip,
  type DateRange,
  Field,
  NEW_TRIP_COLORS,
  Pill,
  rangeDays,
  SectionLabel,
  SOFT_SHADOW,
  startOfDay,
  Stepper,
} from "@/components/new-trip-ui";
import { ApiError, useApi } from "@/lib/api";
import {
  BUDGET_LEVELS,
  type BudgetLevel,
  INTERESTS,
  type Interest,
  MAX_TRAVELERS,
  MAX_TRIP_DAYS,
  type Pace,
  PACES,
  toIsoDate,
  tripDays,
} from "@/lib/trip-rules";

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  back: "Retour",
  title: "Planifier un voyage",
  assistant:
    "Bonjour ! Je suis ton assistant de voyage intelligent. Dis-moi tes préférences, et je te concocterai un voyage inoubliable.",
  where: "Où ?",
  wherePlaceholder: "ex : Tokyo, Japon",
  when: "Quand ?",
  openCalendar: "Choisir les dates",
  months: [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ],
  weekdays: ["D", "L", "M", "M", "J", "V", "S"],
  previousMonth: "Mois précédent",
  nextMonth: "Mois suivant",
  dayOfMonth: (day: number) => (day === 1 ? "1er" : `${day}`),
  singleDay: (day: string, month: string) => `Le ${day} ${month}`,
  sameMonthRange: (from: string, to: string, month: string) => `Du ${from} au ${to} ${month}`,
  crossMonthRange: (from: string, fromMonth: string, to: string, toMonth: string) =>
    `Du ${from} ${fromMonth} au ${to} ${toMonth}`,
  dayCount: (n: number) => `${n} jour${n > 1 ? "s" : ""}`,
  budget: "Budget (par personne)",
  travelers: "Voyageurs",
  travelersCount: (n: number) => `${n} voyageur${n > 1 ? "s" : ""}`,
  fewerTravelers: "Un voyageur de moins",
  moreTravelers: "Un voyageur de plus",
  interests: "Centres d’intérêt",
  pace: "Rythme",
  generate: "Générer mon itinéraire",
  errors: {
    quota: "Vous avez atteint votre quota de voyages pour ce mois.",
    invalid: "Vérifiez les informations du voyage.",
    network: "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",
    generic: "Une erreur est survenue. Réessayez.",
  },
} as const;

const BUDGET_LABELS: Record<BudgetLevel, string> = { budget: "Budget", comfort: "Confort", luxury: "Luxe" };
const BUDGET_ICONS = { budget: WalletIcon, comfort: SeatIcon, luxury: DiamondIcon } as const;
const PACE_LABELS: Record<Pace, string> = { relaxed: "Tranquille", balanced: "Équilibré", intense: "Soutenu" };
const INTEREST_LABELS: Record<Interest, string> = {
  adventure: "Aventure",
  beaches: "Plages",
  food: "Gastronomie",
  culture: "Culture",
  nature: "Nature",
  nightlife: "Vie nocturne",
  shopping: "Shopping",
  history: "Histoire",
  relaxation: "Détente",
  "road-trips": "Road trips",
};

/** Body of POST /api/trips (validated server-side by `newTripSchema`). */
type NewTripBody = {
  destination: string;
  startDate: string;
  endDate: string;
  budget: BudgetLevel;
  travelers: number;
  interests: Interest[];
  pace: Pace;
};

// "Le 11 octobre", "Du 23 au 26 juin · 4 jours", "Du 30 octobre au 2 novembre · 4 jours".
function formatRange({ from, to }: DateRange) {
  const day = TEXTS.dayOfMonth;
  const month = (date: Date) => TEXTS.months[date.getMonth()];
  if (!to) return TEXTS.singleDay(day(from.getDate()), month(from));
  const range =
    from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()
      ? TEXTS.sameMonthRange(day(from.getDate()), day(to.getDate()), month(to))
      : TEXTS.crossMonthRange(day(from.getDate()), month(from), day(to.getDate()), month(to));
  return `${range} · ${TEXTS.dayCount(rangeDays({ from, to }))}`;
}

/** The message shown under the button for a failed submission. */
function submissionError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return TEXTS.errors.quota;
    if (error.status === 400) return TEXTS.errors.invalid;
    return TEXTS.errors.generic;
  }
  return TEXTS.errors.network;
}

const BUTTON_SHADOW = { boxShadow: "0 4px 12px rgba(76, 151, 247, 0.35)" } as const;
const PRIMARY_ICON = NEW_TRIP_COLORS.icon;

// Sizes follow design/new-trip-ui-design-1-top.jpg (1 px = 0.679 dp); the sections below the
// budget follow design/new-trip-ui-design-2-scrolled.jpg (1 px = 0.536 dp).
export default function NewTripScreen() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const [destination, setDestination] = useState("");
  // Today is selected on arrival; earlier days cannot be chosen.
  const today = useMemo(() => startOfDay(new Date()), []);
  const [dates, setDates] = useState<DateRange>({ from: today, to: null });
  const [budget, setBudget] = useState<BudgetLevel>("comfort");
  const [travelers, setTravelers] = useState(2);
  const [interests, setInterests] = useState<Set<Interest>>(new Set<Interest>(["beaches", "food"]));
  const [pace, setPace] = useState<Pace>("relaxed");

  const toggleInterest = (interest: Interest) =>
    setInterests((current) => {
      const next = new Set(current);
      if (!next.delete(interest)) next.add(interest);
      return next;
    });

  // POST /api/trips answers 202 with the trip id as soon as the job is queued; the progress
  // screen then follows the generation.
  const createTrip = useMutation({
    mutationFn: (body: NewTripBody) => api.post<{ tripId: string }>("/api/trips", body),
    onSuccess: ({ tripId }, body) => {
      // The inputs of the generation, next to the trip id the progress screen will report on; read
      // from the body that was sent, not from the form state, which may have moved on since.
      Sentry.logger.info("Trip generation requested", {
        trip_id: tripId,
        days: tripDays(body.startDate, body.endDate),
        travelers: body.travelers,
        budget: body.budget,
        pace: body.pace,
        interests: body.interests.join(","),
      });
      router.replace({ pathname: "/trips/[id]/progress", params: { id: tripId } });
    },
  });
  const canSubmit = destination.trim().length >= 2 && !createTrip.isPending;
  const submit = () =>
    createTrip.mutate({
      destination: destination.trim(),
      startDate: toIsoDate(dates.from),
      endDate: toIsoDate(dates.to ?? dates.from),
      budget,
      travelers,
      interests: INTERESTS.filter((interest) => interests.has(interest)),
      pace,
    });
  const errorMessage = createTrip.isError ? submissionError(createTrip.error) : null;

  const bottomBarHeight = 10 + 49 + 12 + insets.bottom + (errorMessage ? 26 : 0);

  return (
    <View className="flex-1 bg-[#EBEDF2]">
      <StatusBar style="dark" />

      {/* Back button and centred title. */}
      <View className="h-[56px] justify-center" style={{ marginTop: insets.top }}>
        <Text className="text-center font-sans-bold text-[19px] leading-[24px] text-[#111111]">{TEXTS.title}</Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={TEXTS.back}
          className="absolute left-[14px] h-[36px] w-[36px] items-center justify-center rounded-full bg-[#EEF0F5]"
          style={SOFT_SHADOW}
        >
          <ChevronLeftIcon width={9} color="#2A2D33" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 9, paddingBottom: bottomBarHeight + 22 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* The assistant introduces itself. */}
        <View className="flex-row items-start">
          <Image source={require("@/assets/images/assistant-mascot.png")} className="h-[50px] w-[51px]" contentFit="contain" />
          <View className="ml-[12px] flex-1 rounded-[16px] bg-[#EEF0F5] px-[14px] py-[11px]" style={SOFT_SHADOW}>
            <Text className="font-sans text-[16px] leading-[21px] text-[#1A1A1A]">{TEXTS.assistant}</Text>
          </View>
        </View>

        <SectionLabel className="mt-[18px]">{TEXTS.where}</SectionLabel>
        <Field className="mt-[12px]">
          <PinIcon width={15} color={PRIMARY_ICON} />
          <TextInput
            value={destination}
            onChangeText={setDestination}
            placeholder={TEXTS.wherePlaceholder}
            placeholderTextColor="#8A8F98"
            textAlignVertical="center"
            returnKeyType="done"
            className="ml-[13px] h-full flex-1 py-0 font-sans text-[16px] text-[#1A1A1A]"
          />
        </Field>

        <SectionLabel
          className="mt-[19px]"
          right={
            <Pressable accessibilityRole="button" accessibilityLabel={TEXTS.openCalendar} className="-mr-[7px] h-[36px] w-[36px] items-center justify-center">
              <CalendarIcon width={20} color={PRIMARY_ICON} strokeWidth={1.8} />
            </Pressable>
          }
        >
          {TEXTS.when}
        </SectionLabel>
        <View className="mt-[12px]">
          <Calendar
            value={dates}
            onChange={setDates}
            minDate={today}
            maxDays={MAX_TRIP_DAYS}
            months={TEXTS.months}
            weekdays={TEXTS.weekdays}
            rangeLabel={formatRange(dates)}
            labels={{ previousMonth: TEXTS.previousMonth, nextMonth: TEXTS.nextMonth }}
          />
        </View>

        <SectionLabel className="mt-[19px]">{TEXTS.budget}</SectionLabel>
        <View className="mt-[10px] flex-row gap-[12px]">
          {BUDGET_LEVELS.map((level) => {
            const Icon = BUDGET_ICONS[level];
            const selected = budget === level;
            return (
              <Pill
                key={level}
                label={BUDGET_LABELS[level]}
                selected={selected}
                onPress={() => setBudget(level)}
                icon={<Icon width={19} color={selected ? "#1E3F6E" : "#2A2D33"} />}
              />
            );
          })}
        </View>

        <SectionLabel className="mt-[19px]">{TEXTS.travelers}</SectionLabel>
        <Field className="mt-[12px]">
          <PeopleIcon width={18} color={PRIMARY_ICON} />
          <Text className="ml-[9px] flex-1 font-sans text-[16px] leading-[20px] text-[#1A1A1A]">
            {TEXTS.travelersCount(travelers)}
          </Text>
          <Stepper
            onDecrement={() => setTravelers((n) => Math.max(1, n - 1))}
            onIncrement={() => setTravelers((n) => Math.min(MAX_TRAVELERS, n + 1))}
            labels={{ decrement: TEXTS.fewerTravelers, increment: TEXTS.moreTravelers }}
          />
        </Field>

        <SectionLabel className="mt-[19px]">{TEXTS.interests}</SectionLabel>
        <View className="mt-[10px] flex-row flex-wrap gap-[8px]">
          {INTERESTS.map((interest) => (
            <Chip
              key={interest}
              label={INTEREST_LABELS[interest]}
              selected={interests.has(interest)}
              onPress={() => toggleInterest(interest)}
            />
          ))}
        </View>

        <SectionLabel className="mt-[19px]">{TEXTS.pace}</SectionLabel>
        <View className="mt-[10px] flex-row gap-[12px]">
          {PACES.map((level) => (
            <Pill key={level} label={PACE_LABELS[level]} selected={pace === level} onPress={() => setPace(level)} />
          ))}
        </View>
      </ScrollView>

      {/* Sticky call to action. */}
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-[#D9DCE2] bg-[#EBEDF2] px-[14px] pt-[10px]"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit, busy: createTrip.isPending }}
          disabled={!canSubmit}
          onPress={submit}
          className={`h-[49px] flex-row items-center justify-center rounded-full bg-[#4C97F7] ${canSubmit ? "" : "opacity-60"}`}
          style={BUTTON_SHADOW}
        >
          {createTrip.isPending ? <ActivityIndicator color="#FFFFFF" /> : <SparkleIcon width={24} />}
          <Text className="ml-[9px] font-sans-bold text-[17.5px] leading-[22px] text-white">{TEXTS.generate}</Text>
        </Pressable>
        {errorMessage ? (
          <Text accessibilityLiveRegion="polite" className="mt-[8px] text-center font-sans text-[13px] leading-[18px] text-[#B3261E]">
            {errorMessage}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
