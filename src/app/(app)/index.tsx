import { useAuth, useUser } from "@clerk/expo";
import { Pressable, Text, View } from "react-native";

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  signedInAs: "Connecté en tant que",
  signOut: "Se déconnecter",
} as const;

/** Placeholder home until Phase 6 ("Mes voyages"): shows the session and lets you sign out. */
export default function HomeScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();

  return (
    <View className="flex-1 items-center justify-center bg-[#01090C] px-[50.7px]">
      <Text className="font-sans text-[13px] leading-[17.5px] text-[#D3DBE5]">{TEXTS.signedInAs}</Text>
      <Text className="mt-[6px] font-sans-medium text-[18px] leading-[24px] text-white">
        {user?.primaryEmailAddress?.emailAddress}
      </Text>
      <Pressable
        onPress={() => signOut()}
        accessibilityRole="button"
        className="mt-[32px] h-[42.4px] w-full items-center justify-center rounded-full border border-[#7C8C96] bg-[rgba(14,38,56,0.45)]"
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
