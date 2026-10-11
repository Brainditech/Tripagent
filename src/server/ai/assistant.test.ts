import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import { MAX_HISTORY_MESSAGES, MAX_MESSAGE_LENGTH } from "@/lib/assistant-rules";
import {
  answerTraveller,
  AssistantAnswerError,
  AssistantRefusedError,
  assistantHttpError,
  assistantRequestSchema,
  type AssistantTurn,
} from "@/server/ai/assistant";

const history: AssistantTurn[] = [
  { role: "user", content: "Où partir en avril ?" },
  { role: "assistant", content: "Avril est idéal pour le sud de l'Europe ou le Japon." },
  { role: "user", content: "Plutôt plage et bonne cuisine." },
];

const validAnswer = {
  message: "Voici quelques idées qui mêlent plage et gastronomie. L'une d'elles vous tente ?",
  destinations: [
    { name: "Lisbonne", country: "Portugal", reason: "Douceur, pastéis et plages de Cascais à 30 minutes." },
    { name: "Palerme", country: "Italie", reason: "Marchés, street food et mer déjà tiède." },
  ],
  suggestions: ["Combien de jours à Lisbonne ?", "Que goûter à Palerme ?", "Quel budget pour avril ?"],
};

/** The `answer` call as Claude returns it. */
function toolUse(input: unknown): Anthropic.ToolUseBlock {
  return { type: "tool_use", id: "toolu_1", name: "answer", input, caller: { type: "direct" } };
}

/** A Claude answer as `finalMessage()` returns it, with the given overrides. */
function message(overrides: Partial<Anthropic.Message> = {}): Anthropic.Message {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5-20251001",
    stop_reason: "tool_use",
    stop_sequence: null,
    content: [toolUse(validAnswer)],
    usage: { input_tokens: 800, output_tokens: 200 },
    ...overrides,
  } as Anthropic.Message;
}

/** An SDK client whose stream resolves to the message, or rejects with the error, and keeps the request. */
function fakeClient(outcome: Anthropic.Message | Error) {
  const calls: Anthropic.MessageStreamParams[] = [];
  const finalMessage = () => (outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome));
  const client = {
    messages: {
      stream: (params: Anthropic.MessageStreamParams) => {
        calls.push(params);
        return { finalMessage };
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

describe("assistantRequestSchema", () => {
  it("accepts a conversation that starts and ends with the traveller", () => {
    expect(assistantRequestSchema.safeParse({ messages: history }).success).toBe(true);
  });

  it("refuses a conversation that ends with the assistant, or starts with it", () => {
    expect(assistantRequestSchema.safeParse({ messages: history.slice(0, 2) }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ messages: history.slice(1) }).success).toBe(false);
  });

  it("refuses an empty message, a message too long, and a history too long", () => {
    expect(assistantRequestSchema.safeParse({ messages: [{ role: "user", content: "   " }] }).success).toBe(false);
    const long = { role: "user", content: "a".repeat(MAX_MESSAGE_LENGTH + 1) };
    expect(assistantRequestSchema.safeParse({ messages: [long] }).success).toBe(false);
    const turns = Array.from({ length: MAX_HISTORY_MESSAGES + 1 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: "x",
    }));
    expect(assistantRequestSchema.safeParse({ messages: turns }).success).toBe(false);
  });
});

describe("answerTraveller", () => {
  it("returns the validated answer with the token usage", async () => {
    const { client } = fakeClient(message());
    const result = await answerTraveller({ messages: history, locale: "fr" }, client);
    expect(result.answer).toEqual(validAnswer);
    expect(result.model).toBe("claude-haiku-4-5-20251001");
    expect(result.usage).toEqual({ inputTokens: 800, outputTokens: 200 });
  });

  it("sends the history as is, the language in the system prompt and the forced strict tool", async () => {
    const { client, calls } = fakeClient(message());
    await answerTraveller({ messages: history, locale: "fr-FR" }, client);
    const [params] = calls;
    expect(params.messages).toEqual(history);
    expect(params.system).toEqual([
      expect.objectContaining({ type: "text" }),
      { type: "text", text: "Language of every text: French." },
    ]);
    expect(params.tool_choice).toEqual({ type: "tool", name: "answer" });
    expect(params.tools?.[0]).toMatchObject({ name: "answer", strict: true });
  });

  it("cuts the lists to four destinations and three suggestions, and trims the texts", async () => {
    const generous = {
      message: "  Des idées.  ",
      destinations: Array.from({ length: 6 }, (_, i) => ({ name: `Ville ${i}`, country: "Pays", reason: "Parce que." })),
      suggestions: [" Une ? ", "Deux ?", "", "Trois ?", "Quatre ?"],
    };
    const { client } = fakeClient(message({ content: [toolUse(generous)] }));
    const { answer } = await answerTraveller({ messages: history, locale: "fr" }, client);
    expect(answer.message).toBe("Des idées.");
    expect(answer.destinations).toHaveLength(4);
    expect(answer.suggestions).toEqual(["Une ?", "Deux ?", "Trois ?"]);
  });

  it("throws an answer error when the tool input fails validation, when the answer is cut, or when no tool was called", async () => {
    const broken = message({ content: [toolUse({ message: "", destinations: [], suggestions: [] })] });
    await expect(answerTraveller({ messages: history, locale: "fr" }, fakeClient(broken).client)).rejects.toBeInstanceOf(
      AssistantAnswerError,
    );
    const cut = message({ stop_reason: "max_tokens" });
    await expect(answerTraveller({ messages: history, locale: "fr" }, fakeClient(cut).client)).rejects.toThrow(/cut at/);
    const prose = message({ stop_reason: "end_turn", content: [{ type: "text", text: "Hello", citations: null }] });
    await expect(answerTraveller({ messages: history, locale: "fr" }, fakeClient(prose).client)).rejects.toThrow(
      /did not call answer/,
    );
  });

  it("throws a refusal error when Claude declines", async () => {
    const refused = message({ stop_reason: "refusal", content: [] });
    await expect(answerTraveller({ messages: history, locale: "fr" }, fakeClient(refused).client)).rejects.toBeInstanceOf(
      AssistantRefusedError,
    );
  });

  it("lets SDK errors through unchanged", async () => {
    const outage = new Anthropic.InternalServerError(500, undefined, "overloaded", new Headers());
    await expect(answerTraveller({ messages: history, locale: "fr" }, fakeClient(outage).client)).rejects.toBe(outage);
  });
});

describe("assistantHttpError", () => {
  it("answers 422 to a refusal, 429 to a rate limit and 503 to an outage or an unusable answer", () => {
    expect(assistantHttpError(new AssistantRefusedError())).toMatchObject({ status: 422, code: "assistant_refused" });
    const limited = new Anthropic.RateLimitError(429, undefined, "rate limited", new Headers());
    expect(assistantHttpError(limited)).toMatchObject({ status: 429, code: "assistant_busy" });
    const outage = new Anthropic.InternalServerError(500, undefined, "overloaded", new Headers());
    expect(assistantHttpError(outage)).toMatchObject({ status: 503, code: "assistant_unavailable" });
    const offline = new Anthropic.APIConnectionError({ message: "ECONNRESET" });
    expect(assistantHttpError(offline)).toMatchObject({ status: 503, code: "assistant_unavailable" });
    expect(assistantHttpError(new AssistantAnswerError("cut"))).toMatchObject({ status: 503 });
  });

  it("leaves a rejected request (bad key, unknown model) and unknown errors to the route's 500", () => {
    const unauthorized = new Anthropic.AuthenticationError(
      401,
      { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } },
      "invalid x-api-key",
      new Headers(),
    );
    expect(assistantHttpError(unauthorized)).toBeNull();
    expect(assistantHttpError(new Error("boom"))).toBeNull();
  });
});
