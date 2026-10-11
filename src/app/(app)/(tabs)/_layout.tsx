import { NativeTabs } from "expo-router/unstable-native-tabs";

// Tab labels, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  home: "Accueil",
  assistant: "Assistant",
  trips: "Voyages",
  profile: "Profil",
} as const;

// Blue of the mockup's "Nouveau voyage" button. The mockup marks the selected tab with a black
// line above it, which the Android bar cannot draw, so colour tells the selected tab apart instead.
const COLORS = {
  active: "#1C4C82",
  inactive: "#1B1F2A",
  background: "#FFFFFF",
} as const;

// Android bottom navigation (Material 3). Icons are Material Symbols rendered by expo-symbols,
// so no icon package is bundled. Four tabs: the Android tab bar holds five at most.
export default function TabsLayout() {
  return (
    <NativeTabs
      backgroundColor={COLORS.background}
      iconColor={{ default: COLORS.inactive, selected: COLORS.active }}
      labelStyle={{
        default: { fontFamily: "GoogleSans_500Medium", fontSize: 11, color: COLORS.inactive },
        selected: { color: COLORS.active },
      }}
      disableIndicator
      rippleColor="rgba(28, 76, 130, 0.12)"
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon md="home" />
        <NativeTabs.Trigger.Label>{TEXTS.home}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="assistant">
        <NativeTabs.Trigger.Icon md="auto_awesome" />
        <NativeTabs.Trigger.Label>{TEXTS.assistant}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="trips">
        <NativeTabs.Trigger.Icon md="luggage" />
        <NativeTabs.Trigger.Label>{TEXTS.trips}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon md="person" />
        <NativeTabs.Trigger.Label>{TEXTS.profile}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
