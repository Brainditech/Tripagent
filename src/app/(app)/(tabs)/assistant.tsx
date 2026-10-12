import { useMutation } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AssistantBubble,
  AssistantHeader,
  BubbleText,
  Composer,
  DestinationRow,
  ErrorBubble,
  SuggestionRow,
  TypingIndicator,
  UserBubble,
  WritingBubble,
} from "@/components/assistant-ui";
import { ApiError, useApi } from "@/lib/api";
import { askAssistant, type ChatMessage, type ChatTurn, newMessageId, toHistory } from "@/lib/assistant";
import { MAX_MESSAGE_LENGTH } from "@/lib/assistant-rules";
import { openUrl } from "@/lib/links";
import { unsplashReferralUrl } from "@/lib/trips";

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  title: "Assistant",
  subtitle: "Votre compagnon de voyage IA",
  more: "Options",
  newConversation: "Nouvelle conversation",
  newConversationQuestion: "Effacer la conversation en cours ?",
  cancel: "Annuler",
  clear: "Effacer",
  welcome:
    "Bonjour ! Je suis votre compagnon de voyage. Demandez-moi où partir, quand y aller, quoi emporter, ou tout ce qui touche à votre prochain voyage. 👋",
  starters: ["Où partir en avril ?", "Que mettre dans ma valise pour le Japon ?", "Les meilleures villes pour bien manger"],
  placeholder: "Posez une question sur vos voyages…",
  send: "Envoyer",
  writing: "L’assistant écrit",
  retry: "Réessayer",
  photoCredit: (photographer: string) => `Photo : ${photographer} · Unsplash`,
  errors: {
    refused: "Je ne peux pas répondre à cette demande. Posez-moi une autre question de voyage.",
    busy: "L’assistant est très sollicité. Réessayez dans un instant.",
    unavailable: "L’assistant est indisponible pour le moment. Réessayez.",
    network: "Impossible de joindre le serveur. Vérifiez votre connexion.",
    generic: "Une erreur est survenue. Réessayez.",
  },
} as const;

/** A request: the turns to send, and the conversation they belong to. */
type AskVariables = { history: ChatTurn[]; generation: number };

/** The welcome the app writes itself; it is shown, never sent. */
function welcomeMessage(): ChatMessage {
  return { id: newMessageId(), role: "assistant", content: TEXTS.welcome, at: Date.now(), local: true };
}

/** "09:41", in the device's time zone. */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** The message shown under the traveller's bubble when no answer came. */
function askError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 422) return TEXTS.errors.refused;
    if (error.status === 429) return TEXTS.errors.busy;
    if (error.status === 503) return TEXTS.errors.unavailable;
    return TEXTS.errors.generic;
  }
  return TEXTS.errors.network;
}

/**
 * The travel companion, after design/assistant-ui-design.png: a chat with Claude about anything
 * travel, with destination cards and follow-up suggestions in its answers. The reply shows up as
 * Claude writes it, then the whole answer takes its place. The conversation lives in this screen
 * for the session and goes with every request; nothing is stored.
 */
export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage()]);
  const [draft, setDraft] = useState("");
  // The reply as Claude writes it, until the answer lands.
  const [writing, setWriting] = useState<string | null>(null);

  // Bumped by "Nouvelle conversation". `reset()` detaches the screen from a request in flight but
  // does not stop it, and its `onSuccess` still runs: a reply to a request from before the clear
  // carries an older generation and is dropped instead of landing in the fresh conversation.
  const generation = useRef(0);
  // The request in flight, given up by "Nouvelle conversation" so that Claude stops writing too.
  const inFlight = useRef<AbortController | null>(null);

  const ask = useMutation({
    mutationFn: ({ history, generation: asked }: AskVariables) => {
      const controller = new AbortController();
      inFlight.current = controller;
      return askAssistant(api, history, {
        signal: controller.signal,
        onText: (text) => {
          if (asked === generation.current) setWriting(text);
        },
      });
    },
    onSuccess: (reply, variables) => {
      if (variables.generation !== generation.current) return;
      setMessages((current) => [
        ...current,
        {
          id: newMessageId(),
          role: "assistant",
          content: reply.message,
          at: Date.now(),
          destinations: reply.destinations,
          suggestions: reply.suggestions,
        },
      ]);
    },
    onSettled: (_reply, _error, variables) => {
      if (variables.generation === generation.current) setWriting(null);
    },
  });

  const send = (text: string) => {
    const content = text.trim();
    if (!content || ask.isPending) return;
    const next: ChatMessage[] = [...messages, { id: newMessageId(), role: "user", content, at: Date.now() }];
    setMessages(next);
    setDraft("");
    ask.mutate({ history: toHistory(next), generation: generation.current });
  };

  const startOver = () =>
    Alert.alert(TEXTS.newConversation, TEXTS.newConversationQuestion, [
      { text: TEXTS.cancel, style: "cancel" },
      {
        text: TEXTS.clear,
        style: "destructive",
        onPress: () => {
          inFlight.current?.abort();
          generation.current += 1;
          ask.reset();
          setWriting(null);
          setMessages([welcomeMessage()]);
        },
      },
    ]);

  const last = messages[messages.length - 1];
  const idle = !ask.isPending && !ask.isError;
  // Starters before the first message, then the suggestions of the latest answer.
  const suggestions = idle ? (last.local ? [...TEXTS.starters] : (last.suggestions ?? [])) : [];
  const canSend = draft.trim().length > 0 && !ask.isPending;

  return (
    <View className="flex-1 bg-[#EEF1F6]" style={{ paddingTop: insets.top }}>
      <StatusBar style="dark" />
      <AssistantHeader title={TEXTS.title} subtitle={TEXTS.subtitle} moreLabel={TEXTS.more} onMore={startOver} />

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 12 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message) =>
          message.role === "user" ? (
            <UserBubble key={message.id} text={message.content} time={formatTime(message.at)} />
          ) : (
            <AssistantBubble key={message.id} wide={(message.destinations?.length ?? 0) > 0}>
              <BubbleText>{message.content}</BubbleText>
              {message.destinations && message.destinations.length > 0 ? (
                <DestinationRow
                  destinations={message.destinations}
                  creditLabel={TEXTS.photoCredit}
                  onOpenCredit={(url) => openUrl(unsplashReferralUrl(url))}
                />
              ) : null}
            </AssistantBubble>
          ),
        )}
        {ask.isPending ? writing ? <WritingBubble text={writing} /> : <TypingIndicator label={TEXTS.writing} /> : null}
        {ask.isError ? (
          <ErrorBubble
            message={askError(ask.error)}
            retryLabel={TEXTS.retry}
            onRetry={() => ask.mutate({ history: toHistory(messages), generation: generation.current })}
          />
        ) : null}
      </ScrollView>

      {suggestions.length > 0 ? <SuggestionRow suggestions={suggestions} disabled={ask.isPending} onPress={send} /> : null}
      <Composer
        value={draft}
        onChangeText={setDraft}
        onSend={() => send(draft)}
        canSend={canSend}
        placeholder={TEXTS.placeholder}
        sendLabel={TEXTS.send}
        maxLength={MAX_MESSAGE_LENGTH}
      />
    </View>
  );
}
