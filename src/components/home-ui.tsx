import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode, useState } from "react";
import { type ImageSourcePropType, PixelRatio, Pressable, Text, View } from "react-native";

import { CalendarIcon, ChevronRightIcon, PinIcon, WalletIcon } from "@/components/icons";
import { formatMoney } from "@/lib/format";
import { isGenerating, tripCoverUri, type TripSummary } from "@/lib/trips";

// Building blocks of the home screen (src/app/(app)/(tabs)/index.tsx) and of the Voyages tab,
// sized after design/home-screen-ui-design.jpg: 1 reference px = 0.708 dp (581 px for a 411 dp wide screen).

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  days: (n: number) => `${n} jour${n > 1 ? "s" : ""}`,
  estimatedCost: "Coût estimé :",
  perPerson: "/ p.p.",
  noEstimate: "Budget non estimé",
  generating: "Génération en cours…",
  failed: "La génération a échoué",
  badgeGenerating: "En cours",
  badgeFailed: "Échec",
  details: "Afficher les détails",
  follow: "Suivre la préparation",
} as const;

/** Blue of the mockup's "Nouveau voyage" button, shared by the lists' links and spinners. */
export const HOME_ACCENT = "#1C4C82";

export type Inspiration = {
  id: string;
  title: string;
  subtitle: string;
  cover: ImageSourcePropType;
};

// Soft drop shadow under the cards, as in the reference.
const CARD_SHADOW = { boxShadow: "0 2px 10px rgba(22, 32, 72, 0.08)" } as const;

/** Width of a card's photo, in dp; the cover is requested for that many device pixels. */
const COVER_WIDTH = 180;

/** One line of the card; `lines` lets a long amount ("613 000 ₩ / p.p.") take a second one. */
function InfoRow({ icon, lines = 1, children }: { icon: ReactNode; lines?: number; children: string }) {
  return (
    <View className="min-h-[20px] flex-row items-start">
      <View className="h-[20px] w-[20px] items-center justify-center">{icon}</View>
      <Text numberOfLines={lines} className="ml-[3px] flex-1 pt-[1.5px] font-sans text-[13px] leading-[17px] text-[#111111]">
        {children}
      </Text>
    </View>
  );
}

type TripCardProps = {
  trip: TripSummary;
  onPress?: () => void;
  /** Deletion, after a confirmation. */
  onLongPress?: () => void;
  /** Dimmed while its deletion runs. */
  deleting?: boolean;
};

/**
 * One trip of the lists: its cover (or a placeholder until the generation has picked one), the
 * generated title (the destination until then), the destination, the length, and the estimated
 * cost per person in the destination's currency, or the state of the generation instead. A badge
 * on the photo marks a trip being generated or failed.
 */
export function TripCard({ trip, onPress, onLongPress, deleting = false }: TripCardProps) {
  const generating = isGenerating(trip);
  const failed = trip.status === "failed";
  // A photo that no longer loads (gone from Unsplash) gives way to the placeholder.
  const [brokenCover, setBrokenCover] = useState<string | null>(null);
  const uri = tripCoverUri(trip, PixelRatio.getPixelSizeForLayoutSize(COVER_WIDTH));
  const coverUri = uri === brokenCover ? null : uri;
  const badge = generating ? TEXTS.badgeGenerating : failed ? TEXTS.badgeFailed : null;
  const costRow = trip.estimatedCost
    ? `${TEXTS.estimatedCost} ${formatMoney(trip.estimatedCost.perPerson, trip.estimatedCost.currency)} ${TEXTS.perPerson}`
    : generating
      ? TEXTS.generating
      : failed
        ? TEXTS.failed
        : TEXTS.noEstimate;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      className="mx-[17px] flex-row rounded-[16px] bg-white p-[2px]"
      style={[CARD_SHADOW, deleting && { opacity: 0.5 }]}
    >
      {/* The frame is as tall as the text column; the photo fills it from behind, so it never sizes the card. */}
      <View className="w-[180px] self-stretch overflow-hidden rounded-[14px] bg-[#DDE3EC]">
        {coverUri ? (
          <Image
            source={{ uri: coverUri }}
            accessibilityLabel={trip.coverUnsplash?.alt ?? undefined}
            className="absolute inset-0"
            contentFit="cover"
            transition={200}
            onError={() => setBrokenCover(coverUri)}
          />
        ) : (
          <View className="absolute inset-0 items-center justify-center">
            <PinIcon width={26} color="#8A94A6" />
          </View>
        )}
        {badge ? (
          <View
            className={`absolute left-[8px] top-[8px] h-[22px] justify-center rounded-full px-[9px] ${failed ? "bg-[#D9485A]" : "bg-[#1C4C82]"}`}
          >
            <Text className="font-sans-medium text-[11.5px] leading-[14px] text-white">{badge}</Text>
          </View>
        ) : null}
      </View>

      <View className="flex-1 pb-[5px] pl-[9px] pr-[2px] pt-[7px]">
        <Text numberOfLines={2} className="font-sans-bold text-[14px] leading-[18px] text-[#111111]">
          {trip.title ?? trip.destinationName}
        </Text>

        <View className="mt-[2px]">
          <InfoRow icon={<PinIcon width={13} />}>{trip.destinationName}</InfoRow>
          <InfoRow icon={<CalendarIcon width={12} />}>{TEXTS.days(trip.days)}</InfoRow>
          <InfoRow icon={<WalletIcon width={14} />} lines={2}>
            {costRow}
          </InfoRow>
        </View>

        <View className="mt-[6px] items-end">
          <View className="h-[23px] flex-row items-center rounded-full bg-[#E8E8E8] pl-[11px] pr-[9px]">
            <Text className="font-sans-medium text-[12px] leading-[15px] text-[#111111]">
              {generating ? TEXTS.follow : TEXTS.details}
            </Text>
            <View className="ml-[6px]">
              <ChevronRightIcon width={5} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** What a list says instead of its cards: an empty list, or a failed request with its retry. */
export function ListMessage({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <View className="mx-[17px] items-center rounded-[16px] bg-white px-[20px] py-[22px]" style={CARD_SHADOW}>
      <Text className="text-center font-sans text-[14px] leading-[20px] text-[#5B6578]">{text}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8} className="mt-[10px]">
          <Text className="font-sans-bold text-[14px] leading-[20px]" style={{ color: HOME_ACCENT }}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function InspirationCard({ item, onPress }: { item: Inspiration; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="h-[137px] w-[120px] overflow-hidden rounded-[14px] bg-[#1F2B4D]"
    >
      <Image source={item.cover} className="absolute left-0 top-0 h-full w-full" contentFit="cover" />
      <LinearGradient
        colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.72)"]}
        className="absolute bottom-0 left-0 right-0 h-[78px]"
      />
      <View className="absolute bottom-[9px] left-[8px] right-[5px]">
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          className="font-sans-bold text-[13.5px] leading-[18px] text-white"
        >
          {item.title}
        </Text>
        <Text numberOfLines={1} className="font-sans text-[12px] leading-[16px] text-[#DCDCDC]">
          {item.subtitle}
        </Text>
      </View>
    </Pressable>
  );
}
