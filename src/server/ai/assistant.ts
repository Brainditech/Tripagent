import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { MAX_DESTINATIONS, MAX_HISTORY_MESSAGES, MAX_MESSAGE_LENGTH, MAX_SUGGESTIONS } from "@/lib/assistant-rules";
import { languageName } from "@/server/ai/prompts";
import { toStrictJsonSchema } from "@/server/ai/schema";
import { config, requireEnv } from "@/server/config";
import { HttpError } from "@/server/http";

// The travel companion of the Assistant tab: one Claude call per turn, the conversation coming
// with the request (nothing is stored). Claude answers through a strict tool so that the reply
// text, the destination cards and the follow-up suggestions arrive as validated JSON.

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

/** The SDK client is built on first use, so that a missing key fails the request and not the import. */
function defaultClient(): Anthropic {
  return new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
}

/**
 * Asks Claude for the next turn of the chat through the `answer` tool (forced, strict), then
 * validates the tool input with Zod. Lists longer than the prompt allows are cut rather than
 * refused. SDK errors are thrown as they are; `assistantHttpError` turns them into responses.
 */
export async function answerTraveller(
  input: { messages: AssistantTurn[]; locale: string },
  client: Anthropic = defaultClient(),
): Promise<AssistantResult> {
  const message = await client.messages
    .stream({
      model: config.aiModel,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: [
        { type: "text", text: ASSISTANT_SYSTEM_PROMPT },
        { type: "text", text: `Language of every text: ${languageName(input.locale)}.` },
      ],
      messages: input.messages.map(({ role, content }) => ({ role, content })),
      tools: [ANSWER_TOOL],
      tool_choice: { type: "tool", name: ANSWER_TOOL.name },
    })
    .finalMessage();

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
  return {
    answer: {
      message: data.message.trim(),
      destinations: data.destinations.slice(0, MAX_DESTINATIONS),
      suggestions: data.suggestions
        .map((suggestion) => suggestion.trim())
        .filter(Boolean)
        .slice(0, MAX_SUGGESTIONS),
    },
    model: message.model,
    usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
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
