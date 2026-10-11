import * as Sentry from "@sentry/react-native";
import * as Linking from "expo-linking";

/**
 * Opens a URL in whatever handles it (browser, Google Maps). When nothing does (no browser on
 * the device), there is nothing to do but note it: the host says which kind of link it was, the
 * full URL stays out of the log, and so does the rejection message, which repeats it.
 */
export function openUrl(url: string) {
  Linking.openURL(url).catch(() => {
    const host = /^[a-z]+:\/\/([^/?#]+)/i.exec(url)?.[1] ?? "unknown";
    Sentry.logger.warn("Link could not be opened", { host });
  });
}
