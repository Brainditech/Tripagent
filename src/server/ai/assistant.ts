import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { MAX_DESTINATIONS, MAX_HISTORY_MESSAGES, MAX_MESSAGE_LENGTH, MAX_SUGGESTIONS } from "@/lib/assistant-rules";
import { errorMessage } from "@/lib/errors";
import { languageName } from "@/server/ai/prompts";
import { toStrictJsonSchema } from "@/server/ai/schema";
import { config, requireEnv } from "@/server/config";
import { HttpError } from "@/server/http";
import type { UnsplashCover } from "@/server/unsplash";

// The travel companion of the Assistant tab: one Claude call per turn, the conversation coming
// with the request (nothing is stored). Claude answers through a strict tool so that the reply
// text, the destination cards and the follow-up suggestions arrive as validated JSON; the reply
// text is read out of that JSON as it is written, so the app can show it word by word.

const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

/** Body of POST /api/assistant: the conversation so far, ending with the traveller's new message. */
export const assistantRequestSchema = z.object({
  messages: z
    .array(turnSchema)
    .min(1)
    .max(MAX_HISTORY_MESSAGES)
    .refine(
      (messages) => messages[0].role === "user" && messages[messages.length - 1].role === "user",
      "The conversation must start and end with a user message",
    ),
});
export type AssistantTurn = z.infer<typeof turnSchema>;

/** What Claude returns through the `answer` tool. */
export const assistantAnswerSchema = z.object({
  message: z.string().min(1).describe("The reply, plain text in the requested language, no Markdown"),
  destinations: z
    .array(
      z.object({
        name: z.string().min(1).describe("City or region, e.g. 'Lisbon'"),
        country: z.string().min(1).describe("Country, e.g. 'Portugal'"),
        reason: z.string().min(1).describe("Why it fits what the traveller said, one short sentence"),
      }),
    )
    .describe("Destinations shown as cards, only when the traveller asks where to go; empty otherwise, 4 at most"),
  // Empty strings are filtered out below rather than refused: strict mode cannot enforce minLength.
  suggestions: z
    .array(z.string())
    .describe("3 short follow-up questions the traveller may tap next, in the requested language"),
});
export type AssistantAnswer = z.infer<typeof assistantAnswerSchema>;

const ANSWER_TOOL: Anthropic.Tool = {
  name: "answer",
  description: "Answers the traveller: the reply text, optional destination cards and follow-up suggestions.",
  strict: true,
  // The input comes in fragments as Claude writes it, instead of once complete: that is what lets
  // the reply be shown as it is written (`messageSoFar`). Strict mode keeps the JSON well formed.
  eager_input_streaming: true,
  input_schema: toStrictJsonSchema(assistantAnswerSchema) as Anthropic.Tool.InputSchema,
};

/** A chat turn, not an itinerary: a few sentences, four cards and three suggestions fit easily. */
const MAX_OUTPUT_TOKENS = 1500;

/** Fixed part of every request, kept stable; the language comes as a second block. */
export const ASSISTANT_SYSTEM_PROMPT = `You are Tripagent's travel companion: a warm, knowledgeable assistant inside a trip-planning app, who helps travellers decide where to go, when, and how.

You always answer by calling the answer tool exactly once. Never answer with prose outside the tool.

Rules:
- Stay on travel: destinations, seasons and weather, what to pack, budgets, food, transport, accommodation, local etiquette, safety, documents. For anything else, say in one sentence that you only help with trips and suggest a travel question instead.
- Keep the message short: two to five sentences, plain text. No Markdown, no bullet characters, no headings. Emoji only if the traveller uses them.
- When the traveller asks where to go or wants ideas, fill destinations with 2 to 4 entries (a city or region, its country, and one short sentence on why it fits what they said) and keep the message to a short introduction and a closing question; do not repeat the list in the message. Otherwise leave destinations empty.
- Always give exactly 3 suggestions: short follow-up questions, under 40 characters, written in the traveller's voice (for example "What to pack for April?"), that continue the conversation naturally.
- Be concrete but honest: prices, opening hours, visa rules and schedules change, so give orders of magnitude and point to official sources. Never invent a place, an event or a figure.
- When the traveller wants a complete day-by-day itinerary, answer their question briefly and mention in one sentence that the app's "New trip" button builds a full plan.
- Write every text in the requested language.`;

export type AssistantResult = {
  answer: AssistantAnswer;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
};

/** What `answerTraveller` yields: Claude's go-ahead, the reply as it is written, then the answer. */
export type AssistantProgress =
  /** Claude accepted the request and began the answer; anything that fails before this is an HTTP error. */
  | { type: "start" }
  /** The next piece of the reply text, to append to the previous ones. */
  | { type: "text"; delta: string }
  /** The validated answer, always last. */
  | { type: "answer"; result: AssistantResult };

/** A destination card as the route sends it: with its Unsplash photo, or none when Unsplash has nothing. */
export type AssistantDestination = AssistantAnswer["destinations"][number] & { photo: UnsplashCover | null };

/**
 * The lines of the `POST /api/assistant` response (one JSON value each, `application/x-ndjson`):
 * `text` while Claude writes, then `answer`; or `error` when the answer failed after the response
 * had begun, with the status and code the route would have answered with before the first byte.
 */
export type AssistantStreamEvent =
  | { type: "text"; delta: string }
  | { type: "answer"; message: string; destinations: AssistantDestination[]; suggestions: string[] }
  | { type: "error"; status: number; code: string; message: string };

/** Claude declined the message (safety): the traveller is told to ask something else. */
export class AssistantRefusedError extends Error {
  constructor() {
    super("Claude declined to answer this message");
    this.name = "AssistantRefusedError";
  }
}

/** Claude answered, but not in a usable way (cut, no tool call, invalid input): trying again may help. */
export class AssistantAnswerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssistantAnswerError";
  }
}

/**
 * The reply as a turn the next request will accept (`turnSchema`): trimmed, null when nothing
 * is left, and no longer than `MAX_MESSAGE_LENGTH`. The prompt asks for a few sentences, but a
 * long answer would otherwise poison the conversation: the app sends it back as an assistant
 * turn, and every following request would be refused. A long reply is cut after the last
 * sentence that fits, or mid-way with an ellipsis when no sentence end falls in the second half.
 */
export function fitMessage(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length <= MAX_MESSAGE_LENGTH) return trimmed;
  const room = trimmed.slice(0, MAX_MESSAGE_LENGTH - 1);
  const lastEnd = Math.max(...[". ", "! ", "? ", "\n"].map((end) => room.lastIndexOf(end)));
  if (lastEnd > MAX_MESSAGE_LENGTH / 2) return room.slice(0, lastEnd + 1).trimEnd();
  return `${room.trimEnd()}…`;
}

const JSON_ESCAPES: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };

/**
 * The `message` field of the `answer` input as far as Claude has written it. The input is JSON
 * text that arrives in fragments, and the SDK's tolerant parser leaves an unfinished string out,
 * so the value is read here: from the quote that opens it to the one that closes it, or to the end
 * of what has arrived. Escapes are decoded on the way; one cut by a fragment boundary waits for
 * the next fragment, as does the first half of a surrogate pair written as two escapes. Null until
 * the field has started.
 */
export function messageSoFar(json: string): string | null {
  const field = /"message"\s*:\s*"/.exec(json);
  if (!field) return null;
  let text = "";
  for (let i = field.index + field[0].length; i < json.length; i += 1) {
    const char = json[i];
    if (char === '"') return text;
    if (char !== "\\") {
      text += char;
      continue;
    }
    const escape = json[i + 1];
    if (escape === undefined) break;
    if (escape === "u") {
      const hex = json.slice(i + 2, i + 6);
      if (hex.length < 4) break;
      text += String.fromCharCode(parseInt(hex, 16));
      i += 5;
    } else {
      text += JSON_ESCAPES[escape] ?? escape;
      i += 1;
    }
  }
  const last = text.charCodeAt(text.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? text.slice(0, -1) : text;
}

/** The SDK client is built on first use, so that a missing key fails the request and not the import. */
function defaultClient(): Anthropic {
  return new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
}

/**
 * Asks Claude for the next turn of the chat through the `answer` tool (forced, strict), yielding
 * the reply text as it is written, then the answer once the tool input is validated with Zod.
 * Lists longer than the prompt allows are cut rather than refused. Errors are thrown from the
 * iteration: SDK errors as they are, an answer the SDK cannot read as an `AssistantAnswerError`;
 * `assistantHttpError` turns them into responses. Leaving the iteration early aborts the request.
 */
export async function* answerTraveller(
  input: { messages: AssistantTurn[]; locale: string },
  client: Anthropic = defaultClient(),
): AsyncGenerator<AssistantProgress, void> {
  const stream = client.messages.stream({
    model: config.aiModel,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [
      { type: "text", text: ASSISTANT_SYSTEM_PROMPT },
      { type: "text", text: `Language of every text: ${languageName(input.locale)}.` },
    ],
    messages: input.messages.map(({ role, content }) => ({ role, content })),
    tools: [ANSWER_TOOL],
    tool_choice: { type: "tool", name: ANSWER_TOOL.name },
  });

  // Reading the events and the final message are wrapped together: the SDK parses the tool input
  // when its block ends and throws from whichever of the two is awaited at that moment.
  let message: Anthropic.Message;
  try {
    let json = "";
    let shown = "";
    for await (const event of stream) {
      if (event.type === "message_start") yield { type: "start" };
      if (event.type !== "content_block_delta" || event.delta.type !== "input_json_delta") continue;
      json += event.delta.partial_json;
      const text = messageSoFar(json);
      if (text && text.length > shown.length) {
        const delta = text.slice(shown.length);
        shown = text;
        yield { type: "text", delta };
      }
    }
    message = await stream.finalMessage();
  } catch (error) {
    if (error instanceof Anthropic.APIError) throw error;
    throw new AssistantAnswerError(`Claude's answer could not be read: ${errorMessage(error)}`);
  }

  if (message.stop_reason === "refusal") throw new AssistantRefusedError();
  if (message.stop_reason === "max_tokens") {
    throw new AssistantAnswerError(`Claude's answer was cut at ${MAX_OUTPUT_TOKENS} output tokens`);
  }

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === ANSWER_TOOL.name,
  );
  if (!toolUse) {
    throw new AssistantAnswerError(`Claude did not call ${ANSWER_TOOL.name} (stop reason: ${message.stop_reason})`);
  }

  const parsed = assistantAnswerSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new AssistantAnswerError(`The answer failed validation: ${z.prettifyError(parsed.error)}`);
  }

  const { data } = parsed;
  const text = fitMessage(data.message);
  if (!text) throw new AssistantAnswerError("Claude's answer has no text");
  yield {
    type: "answer",
    result: {
      answer: {
        message: text,
        destinations: data.destinations.slice(0, MAX_DESTINATIONS),
        suggestions: data.suggestions
          .map((suggestion) => suggestion.trim())
          .filter(Boolean)
          .slice(0, MAX_SUGGESTIONS),
      },
      model: message.model,
      usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
    },
  };
}

/**
 * The response for an error of `answerTraveller`: a refusal is a 422 the app explains, a busy
 * or failing Claude is a 429 or a 503 the app invites to retry, and a rejected request (bad
 * key, unknown model) is a misconfiguration left to the route's 500, so it gets logged.
 */
export function assistantHttpError(error: unknown): HttpError | null {
  if (error instanceof AssistantRefusedError) {
    return new HttpError(422, "assistant_refused", "The assistant cannot answer this message.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new HttpError(429, "assistant_busy", "The assistant is busy. Try again in a moment.");
  }
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError ||
    error instanceof Anthropic.BadRequestError ||
    error instanceof Anthropic.NotFoundError
  ) {
    return null;
  }
  if (
    error instanceof AssistantAnswerError ||
    error instanceof Anthropic.APIConnectionError ||
    error instanceof Anthropic.APIError
  ) {
    return new HttpError(503, "assistant_unavailable", "The assistant is unavailable. Try again.");
  }
  return null;
}
