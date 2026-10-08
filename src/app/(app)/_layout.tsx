import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";

// App screens require a signed-in user.
export default function AppLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
