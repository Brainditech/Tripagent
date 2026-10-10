import { type Href, router } from "expo-router";

type NavigateParams = { session: { currentTask?: unknown } | null; decorateUrl: (url: string) => string };

/** `navigate` callback for Clerk's finalize() / setActive(): goes home once the session is active. */
export function navigateAfterAuth(onPendingTask: () => void) {
  return ({ session, decorateUrl }: NavigateParams) => {
    // No session tasks (forced MFA, organizations) are enabled for this app yet.
    if (session?.currentTask) return onPendingTask();
    // decorateUrl() returns a plain string, not a typed route.
    router.replace(decorateUrl("/") as Href);
  };
}
