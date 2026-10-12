import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import { MAX_HISTORY_MESSAGES, MAX_MESSAGE_LENGTH } from "@/lib/assistant-rules";
import {
  answerTraveller,
  AssistantAnswerError,
  type AssistantProgress,
  AssistantRefusedError,
  assistantHttpError,
  assistantRequestSchema,
  type AssistantTurn,
  fitMessage,
  messageSoFar,
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

const input = { messages: history, locale: "fr" };

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

/** The only parts of a stream event that `answerTraveller` reads. */
type FakeEvent = { type: string; index?: number; delta?: { type: string; partial_json?: string; text?: string } };

/** The stream events of a message as the API sends them, the tool input in fragments of a few characters. */
function eventsOf(message: Anthropic.Message, fragment = 7): FakeEvent[] {
  const events: FakeEvent[] = [{ type: "message_start" }];
  message.content.forEach((block, index) => {
    events.push({ type: "content_block_start", index });
    if (block.type === "tool_use") {
      const json = JSON.stringify(block.input);
      for (let at = 0; at < json.length; at += fragment) {
        events.push({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: json.slice(at, at + fragment) } });
      }
    } else if (block.type === "text") {
      events.push({ type: "content_block_delta", index, delta: { type: "text_delta", text: block.text } });
    }
    events.push({ type: "content_block_stop", index });
  });
  events.push({ type: "message_delta" }, { type: "message_stop" });
  return events;
}

type FakeOptions = {
  /** Fail the stream after that many events, with `failure`. */
  failAfter?: number;
  failure?: Error;
};

/**
 * An SDK client whose stream replays the message's events then resolves `finalMessage()` to it,
 * or fails: before any event when `outcome` is an error, after `failAfter` events otherwise.
 * The requests it received are kept.
 */
function fakeClient(outcome: Anthropic.Message | Error, options: FakeOptions = {}) {
  const calls: Anthropic.MessageStreamParams[] = [];
  async function* replay() {
    if (outcome instanceof Error) throw outcome;
    let sent = 0;
    for (const event of eventsOf(outcome)) {
      if (sent === options.failAfter) throw options.failure ?? new Error("the stream ended unexpectedly");
      sent += 1;
      yield event;
    }
  }
  const client = {
    messages: {
      stream: (params: Anthropic.MessageStreamParams) => {
        calls.push(params);
        const events = replay();
        return {
          [Symbol.asyncIterator]: () => events,
          finalMessage: () => (outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome)),
        };
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

/** Runs the generator to its end and returns what it yielded. */
async function collect(progress: AsyncGenerator<AssistantProgress, void>): Promise<AssistantProgress[]> {
  const events: AssistantProgress[] = [];
  for await (const event of progress) events.push(event);
  return events;
}

/** The answer of a complete run. */
async function answerOf(client: Anthropic) {
  const events = await collect(answerTraveller(input, client));
  const last = events[events.length - 1];
  if (last?.type !== "answer") throw new Error("The run ended without an answer");
  return last.result;
}

describe("assistantRequestSchema", () => {
  it("accepts a conversation that starts and ends with the traveller", () => {
    expect(assistantRequestSchema.safeParse({ messages: history }).success).toBe(true);
  });

  it("refuses a conversation that ends with the assistant, or starts with it", () => {
    expect(assistantRequestSchema.safeParse({ messages: history.slice(0, 2) }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ messages: history.slice(1) }).success).toBe(false);
  });

  it("accepts the app's conversation id, and refuses one that could not be a tag", () => {
    expect(assistantRequestSchema.safeParse({ messages: history, conversationId: "mh3k2x-a1b2c3d4" }).success).toBe(true);
    expect(assistantRequestSchema.safeParse({ messages: history, conversationId: "bad id!" }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ messages: history, conversationId: "a".repeat(65) }).success).toBe(false);
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

describe("messageSoFar", () => {
  it("is null until the field starts, then the text written so far", () => {
    expect(messageSoFar("")).toBeNull();
    expect(messageSoFar('{"mess')).toBeNull();
    expect(messageSoFar('{"message": "')).toBe("");
    expect(messageSoFar('{"message": "Avril est')).toBe("Avril est");
    expect(messageSoFar('{"message":"Avril est')).toBe("Avril est");
  });

  it("stops at the closing quote, whatever follows", () => {
    expect(messageSoFar('{"message": "Oui.", "destinations": [{"name": "Lis')).toBe("Oui.");
  });

  it("decodes the escapes and keeps raw emoji", () => {
    expect(messageSoFar('{"message":"Un \\"mot\\"\\nd\\u00e9j\\u00e0 \\\\ fini')).toBe('Un "mot"\ndéjà \\ fini');
    expect(messageSoFar('{"message":"Plage 🏖️ et')).toBe("Plage 🏖️ et");
    expect(messageSoFar('{"message":"Fin\\ud83d\\ude0a !')).toBe("Fin😊 !");
  });

  it("waits for an escape, or the second half of a surrogate pair, cut by a fragment", () => {
    expect(messageSoFar('{"message":"Fin\\')).toBe("Fin");
    expect(messageSoFar('{"message":"Fin\\u00e')).toBe("Fin");
    expect(messageSoFar('{"message":"Fin\\ud83d')).toBe("Fin");
  });
});

describe("answerTraveller", () => {
  it("yields the go-ahead first, then the reply text piece by piece, then the answer", async () => {
    const events = await collect(answerTraveller(input, fakeClient(message()).client));
    expect(events[0]).toEqual({ type: "start" });
    const pieces = events.filter((event) => event.type === "text");
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.map((piece) => piece.delta).join("")).toBe(validAnswer.message);
    expect(events[events.length - 1]).toMatchObject({ type: "answer", result: { answer: validAnswer } });
    expect(events.slice(1, -1).every((event) => event.type === "text")).toBe(true);
  });

  it("returns the validated answer with the token usage", async () => {
    const result = await answerOf(fakeClient(message()).client);
    expect(result.answer).toEqual(validAnswer);
    expect(result.model).toBe("claude-haiku-4-5-20251001");
    expect(result.usage).toEqual({ inputTokens: 800, outputTokens: 200 });
  });

  it("sends the history as is, the language in the system prompt and the forced strict tool, streamed eagerly", async () => {
    const { client, calls } = fakeClient(message());
    await collect(answerTraveller({ messages: history, locale: "fr-FR" }, client));
    const [params] = calls;
    expect(params.messages).toEqual(history);
    expect(params.system).toEqual([
      expect.objectContaining({ type: "text" }),
      { type: "text", text: "Language of every text: French." },
    ]);
    expect(params.tool_choice).toEqual({ type: "tool", name: "answer" });
    expect(params.tools?.[0]).toMatchObject({ name: "answer", strict: true, eager_input_streaming: true });
  });

  it("cuts the lists to four destinations and three suggestions, and trims the texts", async () => {
    const generous = {
      message: "  Des idées.  ",
      destinations: Array.from({ length: 6 }, (_, i) => ({ name: `Ville ${i}`, country: "Pays", reason: "Parce que." })),
      suggestions: [" Une ? ", "Deux ?", "", "Trois ?", "Quatre ?"],
    };
    const { answer } = await answerOf(fakeClient(message({ content: [toolUse(generous)] })).client);
    expect(answer.message).toBe("Des idées.");
    expect(answer.destinations).toHaveLength(4);
    expect(answer.suggestions).toEqual(["Une ?", "Deux ?", "Trois ?"]);
  });

  it("throws an answer error when the tool input fails validation, when the answer is cut, or when no tool was called", async () => {
    const broken = message({ content: [toolUse({ message: "", destinations: [], suggestions: [] })] });
    await expect(collect(answerTraveller(input, fakeClient(broken).client))).rejects.toBeInstanceOf(AssistantAnswerError);
    const cut = message({ stop_reason: "max_tokens" });
    await expect(collect(answerTraveller(input, fakeClient(cut).client))).rejects.toThrow(/cut at/);
    const prose = message({ stop_reason: "end_turn", content: [{ type: "text", text: "Hello", citations: null }] });
    await expect(collect(answerTraveller(input, fakeClient(prose).client))).rejects.toThrow(/did not call answer/);
  });

  it("throws a refusal error when Claude declines", async () => {
    const refused = message({ stop_reason: "refusal", content: [] });
    await expect(collect(answerTraveller(input, fakeClient(refused).client))).rejects.toBeInstanceOf(AssistantRefusedError);
  });

  it("throws before yielding anything when Claude rejects the request", async () => {
    const limited = new Anthropic.RateLimitError(429, undefined, "rate limited", new Headers());
    const progress = answerTraveller(input, fakeClient(limited).client);
    await expect(progress.next()).rejects.toBe(limited);
  });

  it("turns an answer the SDK cannot read into an answer error, and lets an SDK error through unchanged", async () => {
    const unreadable = fakeClient(message(), { failAfter: 5, failure: new SyntaxError("Unexpected token") });
    await expect(collect(answerTraveller(input, unreadable.client))).rejects.toThrow(/could not be read: Unexpected token/);
    const outage = new Anthropic.InternalServerError(500, undefined, "overloaded", new Headers());
    await expect(collect(answerTraveller(input, fakeClient(message(), { failAfter: 5, failure: outage }).client))).rejects.toBe(outage);
    await expect(collect(answerTraveller(input, fakeClient(outage).client))).rejects.toBe(outage);
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

describe("fitMessage", () => {
  it("keeps a short message, trimmed", () => {
    expect(fitMessage("  Bonne idée.  ")).toBe("Bonne idée.");
  });

  it("answers null when nothing is left, so the route retries instead of storing an empty turn", () => {
    expect(fitMessage("   ")).toBeNull();
  });

  it("cuts a long message after the last sentence that fits", () => {
    const sentence = "Une phrase de quarante caractères environ. ";
    const long = sentence.repeat(80);
    const fitted = fitMessage(long)!;
    expect(fitted.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
    expect(fitted.endsWith(".")).toBe(true);
    expect(fitted.startsWith(sentence.trim())).toBe(true);
  });

  it("cuts mid-way with an ellipsis when no sentence ends in the second half", () => {
    const fitted = fitMessage("x".repeat(MAX_MESSAGE_LENGTH * 2))!;
    expect(fitted).toHaveLength(MAX_MESSAGE_LENGTH);
    expect(fitted.endsWith("…")).toBe(true);
  });

  it("is applied to the answer, so an assistant turn always passes the request schema", async () => {
    const long = message({ content: [toolUse({ ...validAnswer, message: "Phrase. ".repeat(600) })] });
    const { answer } = await answerOf(fakeClient(long).client);
    expect(answer.message.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
    expect(assistantRequestSchema.safeParse({ messages: [...history, { role: "assistant", content: answer.message }, history[0]] }).success).toBe(true);
    const blank = message({ content: [toolUse({ ...validAnswer, message: "   " })] });
    await expect(collect(answerTraveller(input, fakeClient(blank).client))).rejects.toBeInstanceOf(AssistantAnswerError);
  });
});
