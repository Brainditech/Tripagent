import { useSignIn } from "@clerk/expo";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { AuthError, AuthInput, AuthScreen, PrimaryButton } from "@/components/auth-ui";
import { authErrorMessage } from "@/lib/auth-errors";

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  back: "Retour",
  title: "Continuer avec votre e-mail",
  subtitle: "Nous vous envoyons un code à 6 chiffres pour vous connecter, sans mot de passe.",
  placeholder: "adresse@exemple.com",
  submit: "Recevoir un code",
} as const;

export default function EmailScreen() {
  const { signIn, fetchStatus } = useSignIn();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const emailAddress = email.trim();
    setError(null);

    // Unified flow that does not reveal whether the email has an account: the code is sent either
    // way, and an unknown account is turned into a sign-up only after verification (see verify.tsx).
    const { error: createError } = await signIn.create({ identifier: emailAddress, signUpIfMissing: true });
    if (createError) {
      setError(authErrorMessage(createError));
      return;
    }
    const { error: sendError } = await signIn.emailCode.sendCode();
    if (sendError) {
      setError(authErrorMessage(sendError));
      return;
    }
    router.push({ pathname: "/verify", params: { email: emailAddress } });
  };

  return (
    <AuthScreen title={TEXTS.title} subtitle={TEXTS.subtitle} backLabel={TEXTS.back}>
      <AuthInput
        value={email}
        onChangeText={setEmail}
        placeholder={TEXTS.placeholder}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
        hasError={!!error}
        autoFocus
      />
      <AuthError message={error} />
      <PrimaryButton
        label={TEXTS.submit}
        onPress={handleSubmit}
        disabled={!email.trim()}
        loading={fetchStatus === "fetching"}
      />

      {/* Bot protection mount point: with signUpIfMissing it can be required on sign-in too. */}
      <View nativeID="clerk-captcha" />
    </AuthScreen>
  );
}
