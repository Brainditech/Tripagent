import "../../global.css";
import "@/lib/nativewind-interop";
import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import {
  GoogleSans_400Regular,
  GoogleSans_500Medium,
  GoogleSans_600SemiBold,
  GoogleSans_700Bold,
  useFonts,
} from "@expo-google-fonts/google-sans";
import * as Sentry from "@sentry/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { isRunningInExpoGo } from "expo";
import { Stack, useNavigationContainerRef } from "expo-router";
import { useEffect } from "react";

import { queryClient } from "@/lib/query";

// One transaction per screen change (Expo Router runs on React Navigation), with the time to
// initial display measured natively. Expo Go has no native part for that; this app never runs in it.
const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

Sentry.init({
  dsn: "https://caadcf7440c1800b655d9c2626a0f7ab@o4512214175711232.ingest.de.sentry.io/4512215891837008",
  sendDefaultPii: false,
  // Every trace is kept: one production environment and a handful of users. Lower it when traffic grows.
  tracesSampleRate: 1.0,
  // The trace headers (`sentry-trace`, `baggage`) only go to the app's own API routes, called by
  // relative path; Clerk, ImageKit and the rest get none.
  tracePropagationTargets: [/^\/api\//],
  enableNativeFramesTracking: !isRunningInExpoGo(),
  enableLogs: true,
  profilesSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    Sentry.mobileReplayIntegration(),
    // Expo's global `fetch` is native, not React Native's XHR polyfill, so the SDK's default
    // (XHR only) would miss every API call: trace `fetch` too, for one span per request.
    Sentry.reactNativeTracingIntegration({ traceFetch: true }),
    navigationIntegration,
  ],
});

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error("Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to the .env file");
}

function RootLayout() {
  const [fontsLoaded] = useFonts({
    GoogleSans_400Regular,
    GoogleSans_500Medium,
    GoogleSans_600SemiBold,
    GoogleSans_700Bold,
  });

  // Expo Router mounts its navigation container above this layout, so the ref is set by the time
  // this effect runs; registering it is what names the transactions after the routes.
  const navigationRef = useNavigationContainerRef();
  useEffect(() => {
    if (navigationRef.current) navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  if (!fontsLoaded) return null;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="(auth)" />
        </Stack>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default Sentry.wrap(RootLayout);
