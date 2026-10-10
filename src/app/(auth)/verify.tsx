import { useSignIn, useSignUp } from "@clerk/expo";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { AuthError, AuthInput, AuthScreen, PrimaryButton, TextLink } from "@/components/auth-ui";
import { authErrorMessage, clerkErrorCode } from "@/lib/auth-errors";
import { navigateAfterAuth } from "@/lib/auth-navigation";

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  back: "Modifier l’e-mail",
  title: "Saisissez le code",
  subtitle: (email: string) => `Nous avons envoyé un code à 6 chiffres à ${email}.`,
  placeholder: "••••••",
  submit: "Valider",
  resend: "Renvoyer le code",
  resendIn: (seconds: number) => `Renvoyer le code dans ${seconds} s`,
  resent: "Nouveau code envoyé.",
  changeEmail: "Modifier l’adresse e-mail",
  unsupportedStep: "Une étape de vérification supplémentaire est requise. Elle n’est pas encore prise en charge.",
};

const CODE_LENGTH = 6;
const RESEND_DELAY_SECONDS = 30;

type Params = { email?: string };

/** Code entry screen: checks the 6-digit e-mail code and completes the sign-in or the sign-up. */
export default function VerifyScreen() {
  const { email } = useLocalSearchParams<Params>();
  const { signIn, fetchStatus: signInStatus } = useSignIn();
  const { signUp, fetchStatus: signUpStatus } = useSignUp();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_DELAY_SECONDS);
  const loading = signInStatus === "fetching" || signUpStatus === "fetching";

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (!email) return <Redirect href="/email" />;

  const navigate = navigateAfterAuth(() => setError(TEXTS.unsupportedStep));

  /** Checks the code, then finishes the sign-in or creates the missing account. */
  const verify = async (value: string) => {
    setError(null);
    setNotice(null);

    const { error: verifyError } = await signIn.emailCode.verifyCode({ code: value });
    if (verifyError) {
      // signUpIfMissing: the email is verified but has no account yet -> create it from the sign-in.
      if (clerkErrorCode(verifyError) === "sign_up_if_missing_transfer") return completeSignUp();
      return setError(authErrorMessage(verifyError));
    }
    if (signIn.status === "complete") {
      const { error: finalizeError } = await signIn.finalize({ navigate });
      if (finalizeError) setError(authErrorMessage(finalizeError));
      return;
    }
    setError(TEXTS.unsupportedStep);
  };

  /** Creates the account from the verified sign-in (signUpIfMissing transfer) and finishes it. */
  const completeSignUp = async () => {
    const { error: transferError } = await signUp.create({ transfer: true });
    if (transferError) return setError(authErrorMessage(transferError));
    // Only the email is required for this app, so the sign-up is complete right after the transfer.
    if (signUp.status === "complete") {
      const { error: finalizeError } = await signUp.finalize({ navigate });
      if (finalizeError) setError(authErrorMessage(finalizeError));
      return;
    }
    setError(TEXTS.unsupportedStep);
  };

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH && !loading) verify(digits);
  };

  const resend = async () => {
    setError(null);
    setNotice(null);
    const { error: sendError } = await signIn.emailCode.sendCode();
    if (sendError) return setError(authErrorMessage(sendError));
    setCode("");
    setNotice(TEXTS.resent);
    setCooldown(RESEND_DELAY_SECONDS);
  };

  const changeEmail = async () => {
    await signIn.reset();
    await signUp.reset();
    router.back();
  };

  return (
    <AuthScreen title={TEXTS.title} subtitle={TEXTS.subtitle(email)} backLabel={TEXTS.back} onBack={changeEmail}>
      <AuthInput
        variant="code"
        value={code}
        onChangeText={handleChange}
        placeholder={TEXTS.placeholder}
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        hasError={!!error}
        autoFocus
      />
      <AuthError message={error} />
      {notice ? (
        <Text className="mt-[10px] text-center font-sans text-[12px] leading-[16px] text-[#D3DBE5]">{notice}</Text>
      ) : null}
      <PrimaryButton
        label={TEXTS.submit}
        onPress={() => verify(code)}
        disabled={code.length !== CODE_LENGTH}
        loading={loading}
      />

      <View className="mt-[20px] items-center">
        <TextLink
          label={cooldown > 0 ? TEXTS.resendIn(cooldown) : TEXTS.resend}
          onPress={resend}
          disabled={cooldown > 0 || loading}
        />
        <TextLink label={TEXTS.changeEmail} onPress={changeEmail} disabled={loading} />
      </View>

      {/* Bot protection mount point, required on screens that can create a sign-up. */}
      <View nativeID="clerk-captcha" />
    </AuthScreen>
  );
}
