import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { type ImageSourcePropType, Pressable, Text, View } from "react-native";

import { CalendarIcon, ChevronRightIcon, PinIcon, WalletIcon } from "@/components/icons";

// Building blocks of the home screen (src/app/(app)/(tabs)/index.tsx), sized after
// design/home-screen-ui-design.jpg: 1 reference px = 0.708 dp (581 px for a 411 dp wide screen).

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  days: "jours",
  estimatedCost: "Coût estimé\u00A0:",
  perPerson: "/ p.p.",
  details: "Afficher les détails",
} as const;

export type Trip = {
  id: string;
  title: string;
  location: string;
  days: number;
  /** Estimated cost per person, in euros. */
  costPerPerson: number;
  cover: ImageSourcePropType;
};

export type Inspiration = {
  id: string;
  title: string;
  subtitle: string;
  cover: ImageSourcePropType;
};

// Soft drop shadow under the cards, as in the reference.
const CARD_SHADOW = { boxShadow: "0 2px 10px rgba(22, 32, 72, 0.08)" } as const;

function InfoRow({ icon, children }: { icon: ReactNode; children: string }) {
  return (
    <View className="h-[20px] flex-row items-center">
      <View className="w-[20px] items-center">{icon}</View>
      <Text numberOfLines={1} className="ml-[3px] flex-1 font-sans text-[13px] leading-[17px] text-[#111111]">
        {children}
      </Text>
    </View>
  );
}

export function TripCard({ trip, onPress }: { trip: Trip; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="mx-[17px] flex-row rounded-[16px] bg-white p-[2px]"
      style={CARD_SHADOW}
    >
      <Image source={trip.cover} className="w-[180px] self-stretch rounded-[14px]" contentFit="cover" />

      <View className="flex-1 pb-[5px] pl-[9px] pr-[2px] pt-[7px]">
        <Text className="font-sans-bold text-[14px] leading-[18px] text-[#111111]">{trip.title}</Text>

        <View className="mt-[2px]">
          <InfoRow icon={<PinIcon width={13} />}>{trip.location}</InfoRow>
          <InfoRow icon={<CalendarIcon width={12} />}>{`${trip.days} ${TEXTS.days}`}</InfoRow>
          <InfoRow icon={<WalletIcon width={14} />}>
            {`${TEXTS.estimatedCost} ${trip.costPerPerson}\u00A0€ ${TEXTS.perPerson}`}
          </InfoRow>
        </View>

        <View className="mt-[6px] items-end">
          <View className="h-[23px] flex-row items-center rounded-full bg-[#E8E8E8] pl-[11px] pr-[9px]">
            <Text className="font-sans-medium text-[12px] leading-[15px] text-[#111111]">{TEXTS.details}</Text>
            <View className="ml-[6px]">
              <ChevronRightIcon width={5} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
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
