import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, type TextInputProps, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TripagentLogo } from "@/components/tripagent-logo";

// Building blocks for the auth steps, styled like src/app/(auth)/sign-in.tsx.

type AuthScreenProps = {
  title: string;
  subtitle?: string;
  backLabel: string;
  onBack?: () => void;
  children: ReactNode;
};

export function AuthScreen({ title, subtitle, backLabel, onBack, children }: AuthScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-[#01090C]">
      <StatusBar style="light" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-[50.7px]"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
      >
        <Pressable onPress={onBack ?? (() => router.back())} hitSlop={12} className="self-start py-[6px]">
          <Text className="font-sans text-[13px] leading-[17.5px] text-[#D3DBE5]">‹ {backLabel}</Text>
        </Pressable>

        <View className="mt-[40px] items-center">
          <TripagentLogo width={40} />
          <Text className="mt-[24px] text-center font-sans-medium text-[24px] leading-[30px] text-white">
            {title}
          </Text>
          {subtitle ? (
            <Text className="mt-[10px] text-center font-sans text-[13px] leading-[17.5px] text-[#D3DBE5]">
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View className="mt-[32px]">{children}</View>
      </ScrollView>
    </View>
  );
}

type AuthInputProps = TextInputProps & { hasError?: boolean; variant?: "default" | "code" };

export function AuthInput({ hasError, variant = "default", style, ...props }: AuthInputProps) {
  const variantClass =
    variant === "code"
      ? "h-[52px] text-center font-sans-medium text-[22px] tracking-[8px]"
      : "h-[42.4px] px-[18px] font-sans text-[13px]";
  return (
    <TextInput
      placeholderTextColor="#7C8C96"
      selectionColor="#0072FE"
      className={`w-full rounded-full border bg-[rgba(14,38,56,0.45)] py-0 text-white ${variantClass} ${
        hasError ? "border-[#FF6B6B]" : "border-[#7C8C96]"
      }`}
      // Android: no Tailwind class for these; without them the text sits high and gets clipped.
      style={[{ textAlignVertical: "center", includeFontPadding: false }, style]}
      {...props}
    />
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text className="mt-[10px] text-center font-sans text-[12px] leading-[16px] text-[#FF8A8A]">{message}</Text>;
}

type PrimaryButtonProps = { label: string; onPress: () => void; disabled?: boolean; loading?: boolean };

export function PrimaryButton({ label, onPress, disabled, loading }: PrimaryButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      className={`mt-[16px] h-[41.7px] w-full overflow-hidden rounded-full ${inactive ? "opacity-50" : ""}`}
    >
      <LinearGradient colors={["#0072FE", "#005AF6"]} className="flex-1 flex-row items-center justify-center">
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="font-sans-medium text-[12px] leading-[15px] text-white">{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

type TextLinkProps = { label: string; onPress: () => void; disabled?: boolean };

export function TextLink({ label, onPress, disabled }: TextLinkProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button" className="py-[6px]">
      <Text
        className={`text-center font-sans text-[12px] leading-[16px] ${disabled ? "text-[#7C8C96]" : "text-[#D3DBE5]"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
