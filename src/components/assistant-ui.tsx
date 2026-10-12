import { Image } from "expo-image";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { CheckIcon, MoreIcon, PinIcon, SendIcon } from "@/components/icons";
import type { Destination } from "@/lib/assistant";

// Building blocks of the Assistant tab (src/app/(app)/(tabs)/assistant.tsx), after
// design/assistant-ui-design.png. The mockup is a wider phone than the emulator, so its
// proportions are followed rather than measured, and its blue is the app's accent.

export const ASSISTANT_COLORS = {
  page: "#EEF1F6",
  bubble: "#E2E6EE",
  accent: "#4C97F7",
  ink: "#1A1A1A",
  muted: "#6B7079",
  link: "#1E3F6E",
  error: "#C62839",
} as const;

const CARD_SHADOW = { boxShadow: "0 2px 8px rgba(22, 32, 72, 0.08)" } as const;

/** Pin colours of the destination cards, one per card as in the mockup. */
const PIN_COLORS = ["#E04E5F", "#2DB37A", "#E8549A", "#4C97F7"] as const;

type HeaderProps = { title: string; subtitle: string; moreLabel: string; onMore: () => void };

/** Mascot, title and subtitle, with the "more" button on the right. */
export function AssistantHeader({ title, subtitle, moreLabel, onMore }: HeaderProps) {
  return (
    <View className="h-[64px] flex-row items-center px-[14px]">
      <View className="h-[46px] w-[46px] items-center justify-center rounded-full bg-[#DCE6F7]">
        <Image source={require("@/assets/images/assistant-mascot.png")} className="h-[38px] w-[38px]" contentFit="contain" />
      </View>
      <View className="ml-[12px] flex-1">
        <Text className="font-sans-bold text-[20px] leading-[25px] text-[#1A1A1A]">{title}</Text>
        <Text numberOfLines={1} className="font-sans text-[13px] leading-[17px] text-[#6B7079]">
          {subtitle}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={moreLabel}
        onPress={onMore}
        className="h-[40px] w-[40px] items-center justify-center rounded-full bg-[#E2E6EE]"
      >
        <MoreIcon width={20} color="#2A2D33" />
      </Pressable>
    </View>
  );
}

/** A bubble of the assistant: light, on the left. `wide` when it holds cards. */
export function AssistantBubble({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <View
      className={`mt-[10px] rounded-[18px] rounded-bl-[6px] bg-[#E2E6EE] px-[14px] py-[11px] ${
        wide ? "self-stretch" : "max-w-[88%] self-start"
      }`}
    >
      {children}
    </View>
  );
}

export function BubbleText({ children }: { children: string }) {
  return <Text className="font-sans text-[15.5px] leading-[21px] text-[#1A1A1A]">{children}</Text>;
}

/** A bubble of the traveller: blue, on the right, with the time it was sent. */
export function UserBubble({ text, time }: { text: string; time: string }) {
  return (
    <View className="mt-[10px] items-end">
      <View className="max-w-[84%] rounded-[18px] rounded-br-[6px] bg-[#4C97F7] px-[14px] py-[11px]">
        <Text className="font-sans text-[15.5px] leading-[21px] text-white">{text}</Text>
      </View>
      <View className="mr-[6px] mt-[4px] flex-row items-center">
        <Text className="font-sans text-[12px] leading-[15px] text-[#6B7079]">{time}</Text>
        <View className="ml-[4px]">
          <CheckIcon width={13} color="#4C97F7" />
        </View>
      </View>
    </View>
  );
}

type CardProps = {
  destination: Destination;
  pinColor: string;
  creditLabel: (photographer: string) => string;
  onOpenCredit: (url: string) => void;
};

/** One destination: its photo, its name with a coloured pin, why it fits, and the photo credit. */
export function DestinationCard({ destination, pinColor, creditLabel, onOpenCredit }: CardProps) {
  const { photo } = destination;
  return (
    <View className="w-[150px] overflow-hidden rounded-[16px] bg-white" style={CARD_SHADOW}>
      <View className="h-[118px] bg-[#D6E4F8]">
        {photo ? (
          <Image
            source={{ uri: photo.urls.small }}
            className="h-full w-full"
            contentFit="cover"
            transition={200}
            accessibilityLabel={photo.alt ?? undefined}
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <PinIcon width={26} color="#4C97F7" />
          </View>
        )}
      </View>
      <View className="px-[10px] pb-[10px] pt-[8px]">
        <View className="flex-row items-start">
          <View className="mt-[2px]">
            <PinIcon width={12} color={pinColor} />
          </View>
          <Text numberOfLines={2} className="ml-[5px] flex-1 font-sans-bold text-[13.5px] leading-[17px] text-[#1A1A1A]">
            {`${destination.name},\n${destination.country}`}
          </Text>
        </View>
        <Text numberOfLines={4} className="mt-[5px] font-sans text-[12.5px] leading-[16px] text-[#3F4C6B]">
          {destination.reason}
        </Text>
        {photo ? (
          <Pressable accessibilityRole="link" onPress={() => onOpenCredit(photo.photographer.link)} hitSlop={6} className="mt-[6px]">
            <Text numberOfLines={1} className="font-sans text-[10.5px] leading-[13px] text-[#8E9299]">
              {creditLabel(photo.photographer.name)}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

type RowProps = Omit<CardProps, "destination" | "pinColor"> & { destinations: Destination[] };

/** The cards of an answer, scrolled sideways across the whole bubble. */
export function DestinationRow({ destinations, ...card }: RowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-[14px] mt-[10px]"
      contentContainerClassName="gap-[10px] px-[14px] py-[4px]"
    >
      {destinations.map((destination, index) => (
        <DestinationCard
          key={`${destination.name}-${index}`}
          destination={destination}
          pinColor={PIN_COLORS[index % PIN_COLORS.length]}
          {...card}
        />
      ))}
    </ScrollView>
  );
}

type SuggestionsProps = { suggestions: string[]; disabled: boolean; onPress: (suggestion: string) => void };

/** Follow-up questions to tap, above the composer. */
export function SuggestionRow({ suggestions, disabled, onPress }: SuggestionsProps) {
  return (
    <View className="h-[48px]">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="items-center gap-[8px] px-[14px]"
      >
        {suggestions.map((suggestion) => (
          <Pressable
            key={suggestion}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => onPress(suggestion)}
            className="h-[36px] justify-center rounded-full border border-[#D3D8E3] bg-white px-[14px]"
          >
            <Text numberOfLines={1} className="font-sans-medium text-[13.5px] leading-[17px] text-[#1F3A66]">
              {suggestion}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** The reply as the assistant writes it, with a mark where the next words will land. */
export function WritingBubble({ text }: { text: string }) {
  return (
    <AssistantBubble>
      <Text className="font-sans text-[15.5px] leading-[21px] text-[#1A1A1A]">
        {text}
        <Text className="text-[#4C97F7]">▍</Text>
      </Text>
    </AssistantBubble>
  );
}

/** The assistant is about to write. */
export function TypingIndicator({ label }: { label: string }) {
  return (
    <AssistantBubble>
      <View className="h-[21px] w-[40px] items-center justify-center" accessibilityLabel={label} accessibilityRole="progressbar">
        <ActivityIndicator size="small" color="#4C97F7" />
      </View>
    </AssistantBubble>
  );
}

/** The last message got no answer: why, and a way to send it again. */
export function ErrorBubble({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <AssistantBubble>
      <Text className="font-sans text-[14.5px] leading-[20px] text-[#C62839]">{message}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={8} className="mt-[6px] self-start">
        <Text className="font-sans-bold text-[14.5px] leading-[20px] text-[#1E3F6E]">{retryLabel}</Text>
      </Pressable>
    </AssistantBubble>
  );
}

type ComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  canSend: boolean;
  placeholder: string;
  sendLabel: string;
  maxLength: number;
};

/** The text field and the send button. */
export function Composer({ value, onChangeText, onSend, canSend, placeholder, sendLabel, maxLength }: ComposerProps) {
  return (
    <View className="flex-row items-center px-[14px] pb-[10px] pt-[8px]">
      <View className="h-[48px] flex-1 justify-center rounded-full border border-[#D3D8E3] bg-white px-[18px]">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#8A8F98"
          maxLength={maxLength}
          returnKeyType="send"
          onSubmitEditing={canSend ? onSend : undefined}
          textAlignVertical="center"
          className="h-full py-0 font-sans text-[15.5px] text-[#1A1A1A]"
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sendLabel}
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={onSend}
        className={`ml-[10px] h-[48px] w-[48px] items-center justify-center rounded-full bg-[#4C97F7] ${canSend ? "" : "opacity-50"}`}
      >
        <SendIcon width={22} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
