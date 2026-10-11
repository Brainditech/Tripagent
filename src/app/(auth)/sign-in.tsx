import { useSSO } from "@clerk/expo";
import * as Sentry from "@sentry/react-native";
import * as AuthSession from "expo-auth-session";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaFrame, useSafeAreaInsets } from "react-native-safe-area-context";

import { GoogleIcon, MailIcon } from "@/components/auth-icons";
import { TripagentLogo } from "@/components/tripagent-logo";
import { authErrorMessage, ssoDiagnostic } from "@/lib/auth-errors";
import { navigateAfterAuth } from "@/lib/auth-navigation";

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  appName: "Tripagent",
  title: "Votre prochain\nvoyage commence ici",
  subtitle: "Laissez l’IA créer pour vous un voyage\nsur mesure, en quelques minutes.",
  continueWithEmail: "Continuer avec mon adresse e-mail",
  continueWithGoogle: "Continuer avec Google",
  privacyPolicy: "Politique de confidentialité",
  termsOfUse: "Conditions d’utilisation",
  unsupportedStep: "Une étape de vérification supplémentaire est requise. Elle n’est pas encore prise en charge.",
  ssoIncomplete: "Connexion Google incomplète.",
} as const;

// No tint over the top half, then a fade to black behind the content (faint foliage stays visible).
const OVERLAY_COLORS = ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.85)"] as const;
const OVERLAY_LOCATIONS = [0.45, 1] as const;

// Footer bottom spacing from the design, kept clear of the system navigation bar.
const FOOTER_BOTTOM = 35.4;
// Gap above the footer in the design (16:9 screen, 730.6dp tall at this width).
const FOOTER_GAP = 31.3;
const DESIGN_HEIGHT = 730.6;
// Taller screens: this share of the extra height goes above the footer, the rest above the logo.
const EXTRA_HEIGHT_FOOTER_SHARE = 0.4;

// Google sends the browser back to tripagent://sso-callback (allowlisted in Clerk > Native applications).
const SSO_REDIRECT_URL = AuthSession.makeRedirectUri({ scheme: "tripagent", path: "sso-callback" });

/** Welcome screen: sign in with Google or with a code sent by e-mail. */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useSafeAreaFrame();
  const footerGap = FOOTER_GAP + Math.max(0, height - DESIGN_HEIGHT) * EXTRA_HEIGHT_FOOTER_SHARE;
  const { startSSOFlow } = useSSO();
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  /**
   * Signs in with Google through browser OAuth on Clerk's Google connection
   * (see docs/decisions/0002-google-browser-oauth.md).
   */
  const signInWithGoogle = async () => {
    if (googlePending) return;
    setGooglePending(true);
    setGoogleError(null);
    try {
      const { createdSessionId, setActive, signIn, signUp, authSessionResult } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: SSO_REDIRECT_URL,
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: navigateAfterAuth(() => setGoogleError(TEXTS.unsupportedStep)),
        });
        return;
      }
      // The user closed the Google page: nothing to show.
      if (authSessionResult?.type !== "success") return;
      // Google did come back, so Android also handed the deep link to the router, which pushed
      // sso-callback on top of this screen: pop it, then show why no session was created.
      router.dismissTo("/sign-in");
      if (signUp?.status === "missing_requirements") {
        // Clerk asks for fields this app does not collect (a name, a phone…): the user is stuck here.
        Sentry.logger.warn("Google sign-up needs fields the app does not collect", {
          missing_fields: signUp.missingFields.join(","),
        });
        setGoogleError(TEXTS.unsupportedStep);
        return;
      }
      // The diagnostic names Clerk statuses and the provider error: logged, and shown on screen in
      // development builds only.
      const diagnostic = ssoDiagnostic({ url: authSessionResult.url, signIn, signUp });
      Sentry.logger.warn("Google SSO ended without a session", { diagnostic });
      setGoogleError(__DEV__ ? `${TEXTS.ssoIncomplete} ${diagnostic}` : TEXTS.ssoIncomplete);
    } catch (error) {
      // authErrorMessage logs the Clerk error.
      setGoogleError(authErrorMessage(error));
    } finally {
      setGooglePending(false);
    }
  };

  return (
    <View className="flex-1 bg-[#01090C]">
      <StatusBar style="light" />
      <Image
        source={require("@/assets/images/auth-bg.jpg")}
        contentFit="cover"
        contentPosition="right"
        className="absolute inset-0"
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

        <Pressable
          onPress={() => router.push("/email")}
          disabled={googlePending}
          accessibilityRole="button"
          className="mt-[28.7px] h-[41.7px] w-full overflow-hidden rounded-full"
        >
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

        <View className="relative w-full">
          <Pressable
            onPress={signInWithGoogle}
            disabled={googlePending}
            accessibilityRole="button"
            accessibilityState={{ disabled: googlePending, busy: googlePending }}
            className="mt-[11px] h-[42.8px] w-full flex-row items-center justify-center rounded-full border pl-[2px] border-[#7C8C96] bg-[rgba(14,38,56,0.45)]"
          >
            {googlePending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <GoogleIcon size={17.8} />
                <Text className="ml-[13px] font-sans-medium text-[10.4px] leading-[14px] text-white">
                  {TEXTS.continueWithGoogle}
                </Text>
              </>
            )}
          </Pressable>
          {/* Absolutely positioned so an error does not move the design layout. */}
          {googleError ? (
            <Text className="absolute left-0 right-0 top-full mt-[8px] text-center font-sans text-[12px] leading-[16px] text-[#FF8A8A]">
              {googleError}
            </Text>
          ) : null}
        </View>

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
