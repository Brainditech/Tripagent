import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Pressable, type StyleProp, Text, View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

import { BotIcon, PinIcon } from "@/components/icons";

// Building blocks of the trip detail screen (src/app/(app)/trips/[id]/index.tsx), sized after
// design/trip-detail-ui-design.jpg: 1 reference px = 0.632 dp (650 px for a 411 dp wide screen).

export const DETAIL_COLORS = {
  page: "#FFFFFF",
  ink: "#111111",
  text: "#1A1A1A",
  muted: "#6B7079",
  /** Blue of the numbered discs, the icons and the links. */
  accent: "#3674E3",
  /** Pale disc behind the three icons under the cover. */
  tile: "#E5EEF7",
  /** Background of the day, hotel and budget cards. */
  card: "#E9F2FB",
  divider: "#D5E2F3",
  /** Shown behind the cover while it loads, or when the trip has none. */
  coverFallback: "#1F2B4D",
} as const;

const BUTTON_SHADOW = { boxShadow: "0 3px 10px rgba(20, 30, 60, 0.18)" } as const;
const FAB_SHADOW = { boxShadow: "0 6px 16px rgba(47, 111, 224, 0.40)" } as const;

/** How much lower the cover reaches in the middle than on the sides. */
export const CURVE_HEIGHT = 22;

/** White shape laid over the bottom of the cover: its top edge dips in the middle, so the photo ends on a curve. */
export function CoverCurve({ width }: { width: number }) {
  const h = CURVE_HEIGHT;
  return (
    <View className="absolute bottom-0 left-0" pointerEvents="none">
      <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
        <Path d={`M0 0 Q ${width / 2} ${h * 2} ${width} 0 V ${h} H 0 Z`} fill={DETAIL_COLORS.page} />
      </Svg>
    </View>
  );
}

/** Round white button laid over the cover: back on the left, change the cover and delete on the right. */
export function CoverButton({
  icon,
  label,
  onPress,
  className = "",
  style,
}: {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={`h-[38px] w-[38px] items-center justify-center rounded-full bg-white ${className}`}
      style={[BUTTON_SHADOW, style]}
    >
      {icon}
    </Pressable>
  );
}

/** One of the three figures under the cover: an icon in a pale disc, the value, then its label. */
export function StatTile({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <View className="flex-1 items-center px-[4px]">
      <View className="h-[50px] w-[50px] items-center justify-center rounded-full bg-[#E5EEF7]">{icon}</View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        className="mt-[14px] font-sans-bold text-[20px] leading-[25px] text-[#1A1A1A]"
      >
        {value}
      </Text>
      <Text className="mt-[2px] text-center font-sans text-[14.5px] leading-[19px] text-[#6B7079]">{label}</Text>
    </View>
  );
}

export function SectionTitle({ children, subtitle }: { children: string; subtitle?: string }) {
  return (
    <View>
      <Text className="font-sans-bold text-[24px] leading-[30px] text-[#111111]">{children}</Text>
      {subtitle ? (
        <Text className="mt-[4px] font-sans text-[15px] leading-[21px] text-[#6B7079]">{subtitle}</Text>
      ) : null}
    </View>
  );
}

/** Pale blue card with a numbered disc and the day's theme, holding its activities. */
export function DayCard({
  number,
  title,
  date,
  children,
}: {
  number: number;
  title: string;
  date: string;
  children: ReactNode;
}) {
  return (
    <View className="rounded-[16px] bg-[#E9F2FB] px-[16px] pb-[16px] pt-[14px]">
      <View className="flex-row items-center">
        <View className="h-[30px] w-[30px] items-center justify-center rounded-full bg-[#3674E3]">
          <Text className="font-sans-bold text-[15px] leading-[19px] text-white">{number}</Text>
        </View>
        <View className="ml-[12px] flex-1">
          <Text className="font-sans-bold text-[17px] leading-[22px] text-[#111111]">{title}</Text>
          <Text className="font-sans text-[13px] leading-[17px] text-[#6B7079]">{date}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

/** Link to Google Maps, shown under every place. */
export function MapsLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8} className="flex-row items-center">
      <PinIcon width={11} color={DETAIL_COLORS.accent} />
      <Text className="ml-[4px] font-sans-medium text-[13px] leading-[17px] text-[#3674E3]">{label}</Text>
    </Pressable>
  );
}

/** One activity of a day: when, what, why, then how long and how much, with its Maps link. */
export function ActivityRow({
  first,
  timeOfDay,
  name,
  description,
  meta,
  mapsLabel,
  onOpenMaps,
}: {
  first: boolean;
  timeOfDay: string;
  name: string;
  description: string;
  meta: string;
  mapsLabel: string;
  onOpenMaps: () => void;
}) {
  return (
    <View className={first ? "mt-[12px]" : "mt-[12px] border-t border-[#D5E2F3] pt-[12px]"}>
      <Text className="font-sans-semibold text-[12px] leading-[15px] text-[#3674E3]">{timeOfDay.toUpperCase()}</Text>
      <Text className="mt-[3px] font-sans-bold text-[16px] leading-[21px] text-[#111111]">{name}</Text>
      <Text className="mt-[4px] font-sans text-[15px] leading-[21px] text-[#1A1A1A]">{description}</Text>
      <View className="mt-[8px] flex-row items-center justify-between">
        <Text className="mr-[12px] shrink font-sans text-[13px] leading-[17px] text-[#6B7079]">{meta}</Text>
        <MapsLink label={mapsLabel} onPress={onOpenMaps} />
      </View>
    </View>
  );
}

/** A suggested hotel: name, why it fits, price per night and its Maps link. */
export function HotelCard({
  name,
  description,
  price,
  mapsLabel,
  onOpenMaps,
}: {
  name: string;
  description: string;
  price: string;
  mapsLabel: string;
  onOpenMaps: () => void;
}) {
  return (
    <View className="rounded-[16px] bg-[#E9F2FB] px-[16px] py-[14px]">
      <Text className="font-sans-bold text-[16px] leading-[21px] text-[#111111]">{name}</Text>
      <Text className="mt-[4px] font-sans text-[15px] leading-[21px] text-[#1A1A1A]">{description}</Text>
      <View className="mt-[8px] flex-row items-center justify-between">
        <Text className="mr-[12px] shrink font-sans-medium text-[14px] leading-[18px] text-[#1A1A1A]">{price}</Text>
        <MapsLink label={mapsLabel} onPress={onOpenMaps} />
      </View>
    </View>
  );
}

export type BudgetRow = { label: string; value: string };

/** The per-person estimate: one row per category, the total, then how it was made. */
export function BudgetTable({ rows, total, notes }: { rows: BudgetRow[]; total: BudgetRow; notes: string }) {
  return (
    <View className="rounded-[16px] bg-[#E9F2FB] px-[16px] pb-[14px] pt-[4px]">
      {rows.map((row) => (
        <View key={row.label} className="h-[40px] flex-row items-center justify-between">
          <Text className="font-sans text-[15px] leading-[20px] text-[#1A1A1A]">{row.label}</Text>
          <Text className="font-sans-medium text-[15px] leading-[20px] text-[#1A1A1A]">{row.value}</Text>
        </View>
      ))}
      <View className="h-[46px] flex-row items-center justify-between border-t border-[#D5E2F3]">
        <Text className="font-sans-bold text-[16px] leading-[21px] text-[#111111]">{total.label}</Text>
        <Text className="font-sans-bold text-[16px] leading-[21px] text-[#3674E3]">{total.value}</Text>
      </View>
      <Text className="font-sans text-[13.5px] leading-[18px] text-[#6B7079]">{notes}</Text>
    </View>
  );
}

/** One practical tip, with a blue bullet. */
export function TipRow({ children }: { children: string }) {
  return (
    <View className="flex-row">
      <View className="mr-[10px] mt-[7px] h-[7px] w-[7px] rounded-full bg-[#3674E3]" />
      <Text className="flex-1 font-sans text-[15px] leading-[21px] text-[#1A1A1A]">{children}</Text>
    </View>
  );
}

/** Floating assistant button, bottom right, as in the mockup. */
export function AssistantFab({ label, onPress, style }: { label: string; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="absolute right-[20px] h-[58px] w-[58px] rounded-full"
      style={[FAB_SHADOW, style]}
    >
      <LinearGradient
        colors={["#4BA3E3", "#2F6FE0"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="h-full w-full items-center justify-center overflow-hidden rounded-full"
      >
        <BotIcon width={30} />
      </LinearGradient>
    </Pressable>
  );
}
