import { ActivityIndicator, View } from "react-native";

// Google returns to tripagent://sso-callback. useSSO() reads that URL itself; Android also hands the
// deep link to the router, which shows this screen (instead of "Unmatched Route") until either
// (auth)/_layout redirects the now signed-in user home, or sign-in.tsx pops it because no session
// was created (and shows why).
export default function SsoCallbackScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-[#01090C]">
      <ActivityIndicator color="#FFFFFF" />
    </View>
  );
}
