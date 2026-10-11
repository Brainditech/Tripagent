import { useAuth, useUser } from "@clerk/expo";
import { Pressable, Text, View } from "react-native";

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  title: "Profil",
  signedInAs: "Connecté en tant que",
  signOut: "Se déconnecter",
} as const;

/** Placeholder until Phase 9 (Réglages) : shows the session and lets you sign out. */
export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();

  return (
    <View className="flex-1 items-center justify-center bg-[#F7F8FB] px-[50.7px]">
      <Text className="font-sans-bold text-[20px] leading-[26px] text-[#0B1230]">{TEXTS.title}</Text>
      <Text className="mt-[24px] font-sans text-[13px] leading-[17.5px] text-[#5B6578]">{TEXTS.signedInAs}</Text>
      <Text className="mt-[6px] font-sans-medium text-[16px] leading-[22px] text-[#0B1230]">
        {user?.primaryEmailAddress?.emailAddress}
      </Text>
      <Pressable
        onPress={() => signOut()}
        accessibilityRole="button"
        className="mt-[32px] h-[42.4px] w-full items-center justify-center rounded-full bg-[#0A5BF5]"
      >
        {/* Full width: a shrink-to-fit Text can be measured slightly too narrow on Android with
            custom fonts, which pushed "déconnecter" onto a hidden second line. */}
        <Text className="w-full text-center font-sans-medium text-[12px] leading-[15px] text-white">
          {TEXTS.signOut}
        </Text>
      </Pressable>
    </View>
  );
}
