import { Pressable, Text } from "react-native";

// Full-width pill buttons shared by the trip screens, after design/new-trip-ui-design-1-top.jpg.

const BUTTON_SHADOW = { boxShadow: "0 4px 12px rgba(76, 151, 247, 0.35)" } as const;

export function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="h-[49px] items-center justify-center rounded-full bg-[#4C97F7]"
      style={BUTTON_SHADOW}
    >
      <Text className="font-sans-bold text-[17.5px] leading-[22px] text-white">{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="h-[49px] items-center justify-center rounded-full border-[1.5px] border-[#C9CCD3] bg-[#EEF0F5]"
    >
      <Text className="font-sans-medium text-[16px] leading-[20px] text-[#2A2D33]">{label}</Text>
    </Pressable>
  );
}
