import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton, SecondaryButton } from "@/components/buttons";
import { ChevronLeftIcon, RouteIcon, SearchIcon, SparkleIcon } from "@/components/icons";
import { SOFT_SHADOW } from "@/components/new-trip-ui";
import { Illustration, PROGRESS_COLORS, ProgressBar, Stepper } from "@/components/trip-progress-ui";
import { useApi } from "@/lib/api";
import { progressOf, type Stage, STAGES, type StageState, stageState } from "@/lib/trip-progress";
import { tripQueryOptions, type TripStatusResponse } from "@/lib/trips";

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  back: "Retour",
  title: "Création de votre voyage",
  destination: (name: string) => `Cap sur ${name} 🌍`,
  stages: {
    itinerary: "Création de l’itinéraire",
    places: "Repérage des lieux",
    finish: "Finalisation",
  },
  steps: {
    queued: "Préparation de votre voyage…",
    "load-trip": "Préparation de votre voyage…",
    "generate-itinerary": "Composition d’un itinéraire sur mesure…",
    "resolve-places": "Repérage des lieux sur la carte…",
    "pick-cover": "Choix de la photo de couverture…",
    save: "Enregistrement de votre voyage…",
  },
  ready: "Votre voyage est prêt !",
  failed: "La génération a échoué.",
  failedHint: "Rien n’a été décompté de votre quota. Vous pouvez réessayer.",
  unreachable: "Impossible de suivre la génération. Vérifiez votre connexion.",
  retry: "Réessayer",
  home: "Retour à l’accueil",
} as const;

const POLL_INTERVAL_MS = 2500;

/** The icon of a stage, in colour while it runs and grey while it waits (a done stage shows a check instead). */
function stageIcon(stage: Stage, state: StageState) {
  const muted = state === "pending";
  switch (stage) {
    case "itinerary":
      return (
        <RouteIcon
          width={24}
          color={muted ? PROGRESS_COLORS.pendingInk : PROGRESS_COLORS.accent}
          endColor={muted ? PROGRESS_COLORS.pendingInk : "#E0484F"}
        />
      );
    case "places":
      return <SearchIcon width={24} color={muted ? PROGRESS_COLORS.pendingInk : PROGRESS_COLORS.accentDeep} />;
    case "finish":
      return <SparkleIcon width={24} color={muted ? PROGRESS_COLORS.pendingInk : "#F2B544"} />;
  }
}

/**
 * Follows a generation: polls the trip status every 2.5 s until it is ready or
 * failed. Once ready, the trip is loaded into the query cache and the detail
 * screen replaces this one; a failure shows a way to retry.
 */
export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();

  const status = useQuery({
    queryKey: ["trip-status", id],
    queryFn: () => api.get<TripStatusResponse>(`/api/trips/${id}/status`),
    refetchInterval: (query) => {
      const current = query.state.data?.status;
      return current === "ready" || current === "failed" ? false : POLL_INTERVAL_MS;
    },
  });
  const tripStatus = status.data?.status;
  const trip = useQuery({ ...tripQueryOptions(api, id), enabled: tripStatus === "ready" });

  // The detail screen reads the same query, so it opens with the trip already in hand.
  const loaded = Boolean(trip.data?.version);
  useEffect(() => {
    if (loaded) router.replace({ pathname: "/trips/[id]", params: { id } });
  }, [loaded, id]);

  const failed = tripStatus === "failed";
  const unreachable = status.isError || trip.isError;
  const currentStep = status.data?.job?.currentStep;
  const progress = progressOf(tripStatus, currentStep);

  const stepText =
    tripStatus === "ready"
      ? TEXTS.ready
      : (currentStep && currentStep in TEXTS.steps ? TEXTS.steps[currentStep as keyof typeof TEXTS.steps] : undefined) ??
        TEXTS.steps.queued;
  const message = failed ? TEXTS.failed : unreachable ? TEXTS.unreachable : stepText;

  const stages = STAGES.map((stage, index) => {
    const state: StageState = failed ? "pending" : stageState(index, progress);
    return { key: stage, label: TEXTS.stages[stage], state, icon: stageIcon(stage, state) };
  });

  return (
    <View className="flex-1 bg-[#EBEDF2]">
      <StatusBar style="dark" />

      <View className="h-[56px] justify-center" style={{ marginTop: insets.top }}>
        <Pressable
          onPress={() => router.replace("/")}
          accessibilityRole="button"
          accessibilityLabel={TEXTS.back}
          className="absolute left-[14px] h-[36px] w-[36px] items-center justify-center rounded-full bg-[#EEF0F5]"
          style={SOFT_SHADOW}
        >
          <ChevronLeftIcon width={9} color="#2A2D33" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-[26px]">
          <Illustration />
        </View>

        <Text className="mt-[4px] text-center font-sans-bold text-[27px] leading-[33px] text-[#1A1A1A]">{TEXTS.title}</Text>
        <Text className="mt-[4px] min-h-[22px] px-[24px] text-center font-sans text-[16px] leading-[22px] text-[#5B6068]">
          {status.data ? TEXTS.destination(status.data.destinationName) : ""}
        </Text>

        <View className="mt-[26px] px-[14px]">
          <Stepper stages={stages} />
        </View>

        <View className="mt-[26px] px-[40px]">
          <ProgressBar target={progress.target} durationMs={progress.durationMs} failed={failed} />
        </View>

        <Text
          accessibilityLiveRegion="polite"
          className={`mt-[14px] min-h-[42px] px-[32px] text-center font-sans text-[15px] leading-[21px] ${
            failed || unreachable ? "text-[#D9485A]" : "text-[#2A2D33]"
          }`}
        >
          {message}
        </Text>
        {failed ? (
          <Text className="px-[32px] text-center font-sans text-[14px] leading-[19px] text-[#6B7079]">{TEXTS.failedHint}</Text>
        ) : null}

        <View className="mt-auto gap-[12px] px-[14px] pt-[24px]">
          {failed ? <PrimaryButton label={TEXTS.retry} onPress={() => router.replace("/new-trip")} /> : null}
          {unreachable && !failed ? (
            <PrimaryButton label={TEXTS.retry} onPress={() => void (trip.isError ? trip.refetch() : status.refetch())} />
          ) : null}
          <SecondaryButton label={TEXTS.home} onPress={() => router.replace("/")} />
        </View>
      </ScrollView>
    </View>
  );
}
