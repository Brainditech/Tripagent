import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";

// Auth screens are for signed-out users only.
export default function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
