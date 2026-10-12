import { Image } from "expo-image";
import { Children, Fragment, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { ChevronRightIcon } from "@/components/icons";

// Building blocks of the Profil tab (src/app/(app)/(tabs)/profile.tsx), after
// design/profile-ui-design-1-top.png (1 reference px ≈ 1.64 dp) and
// design/profile-ui-design-2-scrolled.png (≈ 1.77 dp): white cards with a hairline border on a
// light page, settings rows with an icon and a chevron, two full-width action buttons.

export const PROFILE_COLORS = {
  page: "#F7F8FB",
  border: "#E6E8EE",
  divider: "#EEF0F4",
  accent: "#2563EB",
  accentSoft: "#EAF1FF",
  ink: "#111827",
  muted: "#6B7280",
  icon: "#4B5563",
  chevron: "#A0A7B4",
  danger: "#DC2626",
} as const;

const CARD_SHADOW = { boxShadow: "0 1px 6px rgba(22, 32, 72, 0.06)" } as const;
const RIPPLE = { color: "rgba(17, 24, 39, 0.07)" } as const;

/** White rounded card with a hairline border; clips the ripple of the rows it holds. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <View className={`overflow-hidden rounded-[14px] border border-[#E6E8EE] bg-white ${className}`} style={CARD_SHADOW}>
      {children}
    </View>
  );
}

type IdentityCardProps = { name: string; email: string; initial: string; imageUri: string | null };

/** The account: its photo, or its initial on the accent, then its name and its email. */
export function IdentityCard({ name, email, initial, imageUri }: IdentityCardProps) {
  return (
    <Card className="flex-row items-center px-[16px] py-[16px]">
      <View className="h-[46px] w-[46px] items-center justify-center overflow-hidden rounded-full bg-[#2563EB]">
        {imageUri ? (
          <Image source={{ uri: imageUri }} accessibilityLabel={name} className="h-full w-full" contentFit="cover" transition={200} />
        ) : (
          <Text className="font-sans-bold text-[20px] leading-[24px] text-white" style={{ includeFontPadding: false }}>
            {initial}
          </Text>
        )}
      </View>
      <View className="ml-[14px] flex-1">
        <Text numberOfLines={1} className="font-sans-bold text-[17px] leading-[22px] text-[#111827]">
          {name}
        </Text>
        <Text numberOfLines={1} className="mt-[1px] font-sans text-[13px] leading-[18px] text-[#6B7280]">
          {email}
        </Text>
      </View>
    </Card>
  );
}

export type Stat = { icon: ReactNode; value: string; label: string };

/** Three figures side by side, each under its icon on a soft blue disc. */
export function StatsCard({ stats }: { stats: Stat[] }) {
  return (
    <Card className="flex-row px-[8px] py-[16px]">
      {stats.map((stat) => (
        <View key={stat.label} className="flex-1 items-center">
          <View className="h-[30px] w-[30px] items-center justify-center rounded-full bg-[#EAF1FF]">{stat.icon}</View>
          <Text className="mt-[8px] font-sans-bold text-[20px] leading-[24px] text-[#111827]">{stat.value}</Text>
          <Text numberOfLines={1} className="mt-[1px] font-sans text-[12.5px] leading-[16px] text-[#6B7280]">
            {stat.label}
          </Text>
        </View>
      ))}
    </Card>
  );
}

/** A titled card of rows, separated by hairlines. */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-[22px]">
      <Text className="mb-[8px] ml-[2px] font-sans-medium text-[13px] leading-[16px] text-[#6B7280]">{title}</Text>
      <Card>
        {Children.toArray(children).map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View className="h-[1px] bg-[#EEF0F4]" /> : null}
            {row}
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

type SettingsRowProps = {
  icon: ReactNode;
  label: string;
  /** A read-only setting: shown on the right, in place of the chevron. */
  value?: string;
  /** Without it the row only marks where its feature will be: it does nothing and shows no ripple. */
  onPress?: () => void;
};

/** One line of a group: its icon, its label, then its value or a chevron. */
export function SettingsRow({ icon, label, value, onPress }: SettingsRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      android_ripple={RIPPLE}
      className="h-[46px] flex-row items-center px-[14px]"
    >
      <View className="w-[20px] items-center">{icon}</View>
      <Text numberOfLines={1} className="ml-[12px] flex-1 font-sans text-[15.5px] leading-[20px] text-[#111827]">
        {label}
      </Text>
      {value !== undefined ? (
        <Text numberOfLines={1} className="ml-[10px] shrink font-sans text-[14px] leading-[18px] text-[#6B7280]">
          {value}
        </Text>
      ) : (
        <ChevronRightIcon width={6} color={PROFILE_COLORS.chevron} />
      )}
    </Pressable>
  );
}

type ActionButtonProps = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  /** `danger` draws the button in red on a pink card, for "Supprimer le compte". */
  tone?: "neutral" | "danger";
  className?: string;
};

/** Full-width card-like button with an icon before its label. */
export function ActionButton({ icon, label, onPress, tone = "neutral", className = "" }: ActionButtonProps) {
  const danger = tone === "danger";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      android_ripple={RIPPLE}
      className={`h-[46px] flex-row items-center justify-center overflow-hidden rounded-[14px] border ${
        danger ? "border-[#F7D7D7] bg-[#FFF5F5]" : "border-[#E6E8EE] bg-white"
      } ${className}`}
      style={CARD_SHADOW}
    >
      {icon}
      <Text className={`ml-[8px] font-sans-medium text-[15.5px] leading-[20px] ${danger ? "text-[#DC2626]" : "text-[#111827]"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
