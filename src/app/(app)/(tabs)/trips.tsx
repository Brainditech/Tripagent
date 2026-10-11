import { Text, View } from "react-native";

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  title: "Voyages",
  soon: "La liste complète de vos voyages arrive en Phase 6.",
} as const;

/** Placeholder until Phase 6 (liste « Mes voyages » complète). */
export default function TripsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-[#F7F8FB] px-[32px]">
      <Text className="font-sans-bold text-[20px] leading-[26px] text-[#0B1230]">{TEXTS.title}</Text>
      <Text className="mt-[8px] text-center font-sans text-[13px] leading-[18px] text-[#5B6578]">{TEXTS.soon}</Text>
    </View>
  );
}
