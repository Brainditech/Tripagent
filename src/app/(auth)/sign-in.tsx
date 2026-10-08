import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaFrame, useSafeAreaInsets } from "react-native-safe-area-context";

import { GoogleIcon, MailIcon } from "@/components/auth-icons";
import { TripagentLogo } from "@/components/tripagent-logo";

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  appName: "Tripagent",
  title: "Votre prochain\nvoyage commence ici",
  subtitle: "Laissez l’IA créer pour vous un voyage\nsur mesure, en quelques minutes.",
  continueWithEmail: "Continuer avec mon adresse e-mail",
  continueWithGoogle: "Continuer avec Google",
  privacyPolicy: "Politique de confidentialité",
  termsOfUse: "Conditions d’utilisation",
} as const;

// No tint over the top half, then a fade to black behind the content (faint foliage stays visible).
const OVERLAY_COLORS = [
  "rgba(0, 0, 0, 0)",
  "rgba(0, 0, 0, 0.7)",
  "rgba(0, 0, 0, 0.8)",
  "rgba(0, 0, 0, 0.88)",
] as const;
const OVERLAY_LOCATIONS = [0.42, 0.58, 0.7, 1] as const;

// Footer bottom spacing from the design, kept clear of the system navigation bar.
const FOOTER_BOTTOM = 35.4;
// Gap above the footer in the design (16:9 screen, 730.6dp tall at this width).
const FOOTER_GAP = 31.3;
const DESIGN_HEIGHT = 730.6;
// Taller screens: this share of the extra height goes above the footer, the rest above the logo.
const EXTRA_HEIGHT_FOOTER_SHARE = 0.4;

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useSafeAreaFrame();
  const footerGap = FOOTER_GAP + Math.max(0, height - DESIGN_HEIGHT) * EXTRA_HEIGHT_FOOTER_SHARE;

  return (
    <View className="flex-1 bg-[#01090C]">
      <StatusBar style="light" />
      <Image
        source={require("@/assets/images/auth-bg.jpg")}
        contentFit="cover"
        contentPosition="right"
        className="absolute inset-x-0 -top-[17.4%] bottom-0"
      />
      <LinearGradient
        colors={OVERLAY_COLORS}
        locations={OVERLAY_LOCATIONS}
        className="absolute inset-0"
      />

      <View
        className="flex-1 items-center justify-end px-[50.7px]"
        style={{ paddingBottom: Math.max(FOOTER_BOTTOM, insets.bottom + 8) }}
      >
        <TripagentLogo width={48.5} />
        <Text className="mt-[1px] font-sans-bold text-[26.6px] leading-[34px] text-white">
          {TEXTS.appName}
        </Text>

        <Text className="mt-[20.3px] text-center font-sans-medium text-[26.8px] leading-[30.7px] text-white">
          {TEXTS.title}
        </Text>
        <Text className="mt-[15.25px] text-center font-sans text-[13px] leading-[17.5px] text-[#D3DBE5]">
          {TEXTS.subtitle}
        </Text>

        <Pressable className="mt-[28.7px] h-[41.7px] w-full overflow-hidden rounded-full">
          <LinearGradient
            colors={["#0072FE", "#005AF6"]}
            className="flex-1 flex-row items-center justify-center pl-[2.6px]"
          >
            <MailIcon width={17.5} />
            <Text className="ml-[16.7px] font-sans text-[11.8px] leading-[15px] text-white">
              {TEXTS.continueWithEmail}
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable className="mt-[11px] h-[42.8px] w-full flex-row items-center justify-center rounded-full border pl-[2px] border-[#7C8C96] bg-[rgba(14,38,56,0.45)]">
          <GoogleIcon size={17.8} />
          <Text className="ml-[13px] font-sans-medium text-[10.4px] leading-[14px] text-white">
            {TEXTS.continueWithGoogle}
          </Text>
        </Pressable>

        <View className="flex-row items-center" style={{ marginTop: footerGap }}>
          <Pressable>
            <Text className="font-sans text-[7.8px] leading-[12px] text-[#F6FAFD]">
              {TEXTS.privacyPolicy}
            </Text>
          </Pressable>
          <View className="mx-[20.3px] h-[8.7px] w-px bg-white/50" />
          <Pressable>
            <Text className="font-sans text-[8.4px] leading-[12px] text-[#F6FAFD]">
              {TEXTS.termsOfUse}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
