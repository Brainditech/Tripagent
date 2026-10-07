import "../../global.css";
import { Stack } from "expo-router";
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "https://caadcf7440c1800b655d9c2626a0f7ab@o4512214175711232.ingest.de.sentry.io/4512215891837008",
  sendDefaultPii: false,
  tracesSampleRate: 1.0,
  enableLogs: true,
  profilesSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [Sentry.mobileReplayIntegration()],
});

function RootLayout() {
  return <Stack />;
}

export default Sentry.wrap(RootLayout);
