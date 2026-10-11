import * as Sentry from "@sentry/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Alert, PixelRatio, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/buttons";
import { CalendarIcon, CameraIcon, ChevronLeftIcon, PeopleIcon, TrashIcon, WalletIcon } from "@/components/icons";
import {
  ActivityRow,
  AssistantFab,
  BudgetTable,
  CoverButton,
  CoverCurve,
  CURVE_HEIGHT,
  DayCard,
  DETAIL_COLORS,
  HotelCard,
  SectionTitle,
  StatTile,
  TipRow,
} from "@/components/trip-detail-ui";
import { useApi } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDay, formatMoney } from "@/lib/format";
import {
  customCoverUrl,
  googleMapsUrl,
  type PickedImage,
  type TripResponse,
  tripQueryOptions,
  unsplashReferralUrl,
  uploadTripCover,
} from "@/lib/trips";
import type { TripContent } from "@/server/ai/schema";

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  back: "Retour",
  changeCover: "Changer la photo de couverture",
  coverFailedTitle: "Photo non enregistrée",
  coverFailed: "La photo n’a pas pu être envoyée. Vérifiez votre connexion et réessayez.",
  deleteTrip: "Supprimer le voyage",
  deleteTitle: "Supprimer ce voyage ?",
  deleteMessage: "L’itinéraire et toutes ses versions seront supprimés. Cette action est définitive.",
  cancel: "Annuler",
  delete: "Supprimer",
  deleteFailedTitle: "Suppression impossible",
  deleteFailed: "Le voyage n’a pas pu être supprimé. Vérifiez votre connexion et réessayez.",
  assistant: "Assistant",
  unreachable: "Impossible de charger le voyage. Vérifiez votre connexion.",
  retry: "Réessayer",
  notReady: "Ce voyage n’est pas encore prêt.",
  failed: "La génération de ce voyage a échoué.",
  follow: "Suivre la préparation",
  home: "Retour à l’accueil",
  photoBy: "Photo de",
  photoOn: "sur",
  unsplash: "Unsplash",
  duration: "Durée",
  days: (n: number) => `${n} jour${n > 1 ? "s" : ""}`,
  travelers: (n: number) => (n > 1 ? "Voyageurs" : "Voyageur"),
  budget: "Budget",
  perPerson: "/ personne",
  itinerary: "Itinéraire",
  timeOfDay: { morning: "Matin", afternoon: "Après-midi", evening: "Soir" },
  free: "Gratuit",
  perPersonShort: "/ pers.",
  minutes: (m: number) => `${m} min`,
  hours: (h: number, m: number) => (m > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`),
  maps: "Google Maps",
  hotels: "Hébergement",
  perNight: "/ nuit",
  budgetSubtitle: "Estimation par personne",
  budgetRows: { accommodation: "Hébergement", food: "Repas", activities: "Activités", transport: "Transports" },
  total: "Total",
  tips: "Conseils",
} as const;

type Activity = TripContent["days"][number]["activities"][number];

/** "3 h · Gratuit", "1 h 30 · 1 200 ¥ / pers.", "45 min". */
function activityMeta(activity: Activity, currency: string): string {
  const parts: string[] = [];
  const minutes = activity.durationMinutes;
  if (minutes > 0) {
    parts.push(minutes < 60 ? TEXTS.minutes(minutes) : TEXTS.hours(Math.floor(minutes / 60), minutes % 60));
  }
  parts.push(
    activity.estimatedCost > 0 ? `${formatMoney(activity.estimatedCost, currency)} ${TEXTS.perPersonShort}` : TEXTS.free,
  );
  return parts.join(" · ");
}

function openUrl(url: string) {
  Linking.openURL(url).catch((error: unknown) => {
    // No app handles the link (no browser on the device): nothing to do but note it.
    Sentry.logger.warn("Link could not be opened", { url, message: errorMessage(error) });
  });
}

const BUDGET_CATEGORIES = ["accommodation", "food", "activities", "transport"] as const;

/**
 * The generated trip, laid out after design/trip-detail-ui-design.jpg: the cover with the
 * title and the photographer's credit, three figures (duration, travellers, budget), then the
 * itinerary day by day, the hotels, the budget and the tips. The map of the mockup waits for
 * Google Places and expo-maps (Phase 11): every place links to Google Maps instead. The two
 * buttons at the top right replace the cover with a photo of the user's and delete the trip.
 */
export default function TripDetailScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const queryClient = useQueryClient();
  const trip = useQuery(tripQueryOptions(api, id));
  // The status bar is light over the photo and dark once the white content has scrolled under it.
  const [pastCover, setPastCover] = useState(false);

  const coverHeight = insets.top + 232;
  const buttonTop = insets.top + 8;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

  // DELETE cascades to the versions, messages and jobs; the cached copies go with it.
  const deleteTrip = useMutation({
    mutationFn: () => api.delete(`/api/trips/${id}`),
    onSuccess: () => {
      Sentry.logger.info("Trip deleted", { trip_id: id });
      queryClient.removeQueries({ queryKey: ["trip", id] });
      queryClient.removeQueries({ queryKey: ["trip-status", id] });
      router.replace("/");
    },
    // The API client has logged the refusal.
    onError: () => Alert.alert(TEXTS.deleteFailedTitle, TEXTS.deleteFailed),
  });
  const confirmDelete = () => {
    Alert.alert(
      TEXTS.deleteTitle,
      TEXTS.deleteMessage,
      [
        { text: TEXTS.cancel, style: "cancel" },
        { text: TEXTS.delete, style: "destructive", onPress: () => deleteTrip.mutate() },
      ],
      { cancelable: true },
    );
  };

  // The photo goes straight from the phone to ImageKit, then the API records it; the cached trip follows.
  const changeCover = useMutation({
    mutationFn: (image: PickedImage) => uploadTripCover(api, id, image),
    onSuccess: (coverCustom) => {
      queryClient.setQueryData<TripResponse>(["trip", id], (current) => (current ? { ...current, coverCustom } : current));
    },
    // uploadTripCover has logged which step failed and why.
    onError: () => Alert.alert(TEXTS.coverFailedTitle, TEXTS.coverFailed),
  });
  // The system photo picker, which needs no permission on recent Android versions. Nothing happens on cancel.
  const pickCover = async () => {
    let picked: ImagePicker.ImagePickerResult;
    try {
      picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    } catch {
      return; // A picker is already open.
    }
    const asset = picked.assets?.[0];
    if (picked.canceled || !asset) return;
    changeCover.mutate({ uri: asset.uri, mimeType: asset.mimeType });
  };

  const data = trip.data;
  const content = data?.version?.content ?? null;
  // The user's own cover wins over the Unsplash photo, whose credit goes away with it.
  const customCover = data?.coverCustom ?? null;
  const cover = customCover ? null : (data?.coverUnsplash ?? null);
  const coverUri = customCover
    ? customCoverUrl(customCover, PixelRatio.getPixelSizeForLayoutSize(width))
    : (cover?.urls.regular ?? null);

  if (!data || !content) {
    const message = trip.isError ? TEXTS.unreachable : data?.status === "failed" ? TEXTS.failed : TEXTS.notReady;
    return (
      <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
        <StatusBar style="dark" />
        <View className="h-[56px] justify-center">
          <CoverButton
            icon={<ChevronLeftIcon width={9} color={DETAIL_COLORS.ink} />}
            label={TEXTS.back}
            onPress={goBack}
            className="absolute left-[16px]"
          />
        </View>
        <View className="flex-1 items-center justify-center px-[32px]" style={{ paddingBottom: insets.bottom + 56 }}>
          {trip.isPending ? (
            <ActivityIndicator size="large" color={DETAIL_COLORS.accent} />
          ) : (
            <>
              <Text className="text-center font-sans text-[16px] leading-[22px] text-[#1A1A1A]">{message}</Text>
              <View className="mt-[20px] w-full">
                {trip.isError ? (
                  <PrimaryButton label={TEXTS.retry} onPress={() => void trip.refetch()} />
                ) : data?.status === "failed" ? (
                  <PrimaryButton label={TEXTS.home} onPress={() => router.replace("/")} />
                ) : (
                  <PrimaryButton
                    label={TEXTS.follow}
                    onPress={() => router.replace({ pathname: "/trips/[id]/progress", params: { id } })}
                  />
                )}
              </View>
            </>
          )}
        </View>
      </View>
    );
  }

  const currency = content.currency;
  const total = content.budget.perPerson.total;

  return (
    <View className="flex-1 bg-white">
      <StatusBar style={pastCover ? "dark" : "light"} />

      <ScrollView
        onScroll={(event) => setPastCover(event.nativeEvent.contentOffset.y > coverHeight - insets.top - 24)}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover photo, title and credit; the white page starts on a curve. */}
        <View style={{ height: coverHeight, backgroundColor: DETAIL_COLORS.coverFallback }}>
          {coverUri ? (
            <Image
              source={{ uri: coverUri }}
              accessibilityLabel={cover?.alt ?? undefined}
              className="absolute left-0 top-0 h-full w-full"
              contentFit="cover"
              transition={200}
            />
          ) : null}
          <LinearGradient
            colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.62)"]}
            className="absolute bottom-0 left-0 right-0 h-[180px]"
          />
          <View className="absolute left-[22px] right-[22px]" style={{ bottom: CURVE_HEIGHT + 26 }}>
            <Text className="font-sans-bold text-[28px] leading-[33px] text-white">{content.title}</Text>
            {cover ? (
              <Text className="mt-[6px] text-right font-sans text-[14px] leading-[18px] text-white">
                {TEXTS.photoBy}{" "}
                <Text
                  accessibilityRole="link"
                  className="font-sans-medium"
                  onPress={() => openUrl(unsplashReferralUrl(cover.photographer.link))}
                >
                  {cover.photographer.name}
                </Text>{" "}
                {TEXTS.photoOn}{" "}
                <Text
                  accessibilityRole="link"
                  className="font-sans-medium"
                  onPress={() => openUrl(unsplashReferralUrl("https://unsplash.com/"))}
                >
                  {TEXTS.unsplash}
                </Text>
              </Text>
            ) : null}
          </View>
          <CoverCurve width={width} />
        </View>

        {/* Duration, travellers and budget per person. */}
        <View className="mt-[12px] flex-row px-[10px]">
          <StatTile
            icon={<CalendarIcon width={21} color={DETAIL_COLORS.accent} />}
            value={TEXTS.days(data.days)}
            label={TEXTS.duration}
          />
          <StatTile
            icon={<PeopleIcon width={23} color={DETAIL_COLORS.accent} />}
            value={String(data.travelers)}
            label={TEXTS.travelers(data.travelers)}
          />
          <StatTile
            icon={<WalletIcon width={22} color={DETAIL_COLORS.accent} />}
            value={formatMoney(total, currency)}
            label={`${TEXTS.perPerson}\n${TEXTS.budget}`}
          />
        </View>

        <View className="mt-[30px] px-[20px]">
          <SectionTitle subtitle={content.summary}>{TEXTS.itinerary}</SectionTitle>
          <View className="mt-[16px] gap-[14px]">
            {content.days.map((day, dayIndex) => (
              <DayCard key={dayIndex} number={day.dayNumber} title={day.title} date={formatDay(day.date)}>
                {day.activities.map((activity, index) => (
                  <ActivityRow
                    key={index}
                    first={index === 0}
                    timeOfDay={TEXTS.timeOfDay[activity.timeOfDay]}
                    name={activity.name}
                    description={activity.description}
                    meta={activityMeta(activity, currency)}
                    mapsLabel={TEXTS.maps}
                    onOpenMaps={() => openUrl(googleMapsUrl(activity.place))}
                  />
                ))}
              </DayCard>
            ))}
          </View>
        </View>

        <View className="mt-[30px] px-[20px]">
          <SectionTitle>{TEXTS.hotels}</SectionTitle>
          <View className="mt-[16px] gap-[14px]">
            {content.hotels.map((hotel, index) => (
              <HotelCard
                key={index}
                name={hotel.name}
                description={hotel.description}
                price={`${formatMoney(hotel.pricePerNight, currency)} ${TEXTS.perNight}`}
                mapsLabel={TEXTS.maps}
                onOpenMaps={() => openUrl(googleMapsUrl(hotel.place))}
              />
            ))}
          </View>
        </View>

        <View className="mt-[30px] px-[20px]">
          <SectionTitle subtitle={TEXTS.budgetSubtitle}>{TEXTS.budget}</SectionTitle>
          <View className="mt-[16px]">
            <BudgetTable
              rows={BUDGET_CATEGORIES.map((category) => ({
                label: TEXTS.budgetRows[category],
                value: formatMoney(content.budget.perPerson[category], currency),
              }))}
              total={{ label: TEXTS.total, value: formatMoney(total, currency) }}
              notes={content.budget.notes}
            />
          </View>
        </View>

        <View className="mt-[30px] px-[20px]">
          <SectionTitle>{TEXTS.tips}</SectionTitle>
          <View className="mt-[14px] gap-[10px]">
            {content.tips.map((tip, index) => (
              <TipRow key={index}>{tip}</TipRow>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Back on the left, change the cover and delete on the right: laid over the cover, in place while the page scrolls. */}
      <CoverButton
        icon={<ChevronLeftIcon width={9} color={DETAIL_COLORS.ink} />}
        label={TEXTS.back}
        onPress={goBack}
        className="absolute left-[16px]"
        style={{ top: buttonTop }}
      />
      <CoverButton
        icon={
          changeCover.isPending ? (
            <ActivityIndicator size="small" color={DETAIL_COLORS.accent} />
          ) : (
            <CameraIcon width={20} color={DETAIL_COLORS.ink} />
          )
        }
        label={TEXTS.changeCover}
        onPress={changeCover.isPending ? undefined : () => void pickCover()}
        className="absolute right-[64px]"
        style={{ top: buttonTop }}
      />
      <CoverButton
        icon={
          deleteTrip.isPending ? (
            <ActivityIndicator size="small" color={DETAIL_COLORS.accent} />
          ) : (
            <TrashIcon width={19} color={DETAIL_COLORS.ink} />
          )
        }
        label={TEXTS.deleteTrip}
        onPress={deleteTrip.isPending ? undefined : confirmDelete}
        className="absolute right-[16px]"
        style={{ top: buttonTop }}
      />

      {/* The adjustment chat comes with Phase 7. */}
      <AssistantFab label={TEXTS.assistant} style={{ bottom: insets.bottom + 20 }} />
    </View>
  );
}
