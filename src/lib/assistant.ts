import * as Sentry from "@sentry/react-native";

import type { Api } from "@/lib/api";
import { MAX_HISTORY_MESSAGES } from "@/lib/assistant-rules";
import type { UnsplashCover } from "@/server/unsplash";

// The travel chat of the Assistant tab, as the screen keeps it and as the API answers it. The
// cover type comes from the server as `import type` only, so nothing of the server is bundled.

export type ChatRole = "user" | "assistant";

/** A destination card of an answer, with its Unsplash photo when one was found. */
export type Destination = { name: string; country: string; reason: string; photo: UnsplashCover | null };

/** Answer of `POST /api/assistant`. */
export type AssistantReply = { message: string; destinations: Destination[]; suggestions: string[] };

/** A turn as the API receives it. */
export type ChatTurn = { role: ChatRole; content: string };

/** A turn as the screen shows it. */
export type ChatMessage = ChatTurn & {
  id: string;
  /** When it was written, for the time under the traveller's bubbles. */
  at: number;
  /** True for the welcome, which the app writes itself and never sends. */
  local?: boolean;
  destinations?: Destination[];
  suggestions?: string[];
};

let nextMessageId = 0;

/** An id unique to this run of the app, for the list keys. */
export function newMessageId(): string {
  nextMessageId += 1;
  return `${Date.now()}-${nextMessageId}`;
}

/**
 * The turns sent with a request: the welcome stays on the device, only the latest turns go
 * (the chat is stateless and the server bounds the history), and the sent part starts with the
 * traveller, as the API requires.
 */
export function toHistory(messages: ChatMessage[]): ChatTurn[] {
  const turns = messages
    .filter((message) => !message.local)
    .slice(-MAX_HISTORY_MESSAGES)
    .map(({ role, content }) => ({ role, content }));
  while (turns[0]?.role === "assistant") turns.shift();
  return turns;
}

/**
 * Sends the conversation and returns the assistant's next turn. A failed request is already
 * logged by the API client; an answer is logged with its shape, never its text.
 */
export async function askAssistant(api: Api, history: ChatTurn[]): Promise<AssistantReply> {
  const startedAt = Date.now();
  const reply = await api.post<AssistantReply>("/api/assistant", { messages: history });
  Sentry.logger.info("Assistant answered", {
    turns: history.length,
    destinations: reply.destinations.length,
    suggestions: reply.suggestions.length,
    duration_ms: Date.now() - startedAt,
  });
  return reply;
}
