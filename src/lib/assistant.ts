import * as Sentry from "@sentry/react-native";

import { type Api, ApiError } from "@/lib/api";
import { MAX_HISTORY_MESSAGES } from "@/lib/assistant-rules";
import { errorMessage } from "@/lib/errors";
import type { AssistantDestination, AssistantStreamEvent } from "@/server/ai/assistant";

// The travel chat of the Assistant tab, as the screen keeps it and as the API answers it. The
// server types come as `import type` only, so nothing of the server is bundled.

export type ChatRole = "user" | "assistant";

/** A destination card of an answer, with its Unsplash photo when one was found. */
export type Destination = AssistantDestination;

/** The last line of `POST /api/assistant`: the whole answer. */
export type AssistantReply = Omit<Extract<AssistantStreamEvent, { type: "answer" }>, "type">;

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
 * Reads a response written line by line (`application/x-ndjson`) and calls `onLine` with each
 * JSON value as soon as its line is complete. Lines may be cut anywhere by the network, even in
 * the middle of a character: the decoder keeps the bytes it needs.
 */
export async function readJsonLines<T>(body: ReadableStream<Uint8Array>, onLine: (line: T) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffered += decoder.decode(value, { stream: true });
    if (done) buffered += decoder.decode();
    const lines = buffered.split("\n");
    buffered = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (line.trim()) onLine(JSON.parse(line) as T);
    }
    if (done) return;
  }
}

export type AskOptions = {
  /** Called with the reply as Claude writes it, a little longer each time. */
  onText?: (text: string) => void;
  /** Gives the request up (the traveller cleared the conversation); nothing is logged then. */
  signal?: AbortSignal;
};

/**
 * Sends the conversation and returns the assistant's next turn, reporting the reply text while
 * it is written. A request rejected before the first line is already logged by the API client,
 * and throws its `ApiError`; a failure told on the last line throws the same `ApiError` and is
 * logged here, as is an answer cut before its last line. An answer is logged with its shape and
 * timings, never its text.
 */
export async function askAssistant(api: Api, history: ChatTurn[], options: AskOptions = {}): Promise<AssistantReply> {
  const startedAt = Date.now();
  let firstTextAt: number | null = null;
  let text = "";
  let reply: AssistantReply | null = null;

  const response = await api.stream("/api/assistant", { messages: history }, options.signal);
  try {
    if (!response.body) throw new Error("The answer has no body");
    await readJsonLines<AssistantStreamEvent>(response.body, (event) => {
      if (event.type === "text") {
        firstTextAt ??= Date.now();
        text += event.delta;
        options.onText?.(text);
      } else if (event.type === "answer") {
        reply = { message: event.message, destinations: event.destinations, suggestions: event.suggestions };
      } else if (event.type === "error") {
        throw new ApiError(event.status, event.code, event.message);
      }
    });
    if (!reply) throw new Error("The answer ended before its last line");
  } catch (error) {
    if (options.signal?.aborted) throw error;
    const status = error instanceof ApiError ? error.status : null;
    const log = status !== null && status < 500 ? Sentry.logger.warn : Sentry.logger.error;
    log("Assistant answer failed", {
      turns: history.length,
      status,
      code: error instanceof ApiError ? error.code : null,
      message: errorMessage(error),
      duration_ms: Date.now() - startedAt,
    });
    throw error;
  }

  const answer: AssistantReply = reply;
  Sentry.logger.info("Assistant answered", {
    turns: history.length,
    destinations: answer.destinations.length,
    suggestions: answer.suggestions.length,
    first_text_ms: firstTextAt === null ? null : firstTextAt - startedAt,
    duration_ms: Date.now() - startedAt,
  });
  return answer;
}
