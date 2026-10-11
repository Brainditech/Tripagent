import Anthropic from "@anthropic-ai/sdk";
import { NonRetriableError } from "inngest";
import { describe, expect, it } from "vitest";

import { validItinerary } from "@/server/ai/__fixtures__/itinerary";
import { generateItinerary } from "@/server/ai/generate";
import type { ItineraryInput } from "@/server/ai/prompts";

const input: ItineraryInput = {
  destination: "Tokyo, Japon",
  startDate: "2026-11-02",
  endDate: "2026-11-05",
  days: 4,
  travelers: 2,
  budget: "comfort",
  interests: ["food"],
  pace: "balanced",
  locale: "fr",
};

/** The `save_itinerary` call as Claude returns it. */
function toolUse(input: unknown): Anthropic.ToolUseBlock {
  return { type: "tool_use", id: "toolu_1", name: "save_itinerary", input, caller: { type: "direct" } };
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
    content: [toolUse(validItinerary)],
    usage: { input_tokens: 1000, output_tokens: 3000 },
    ...overrides,
  } as Anthropic.Message;
}

/** An SDK client whose stream resolves to the message, or rejects with the error. */
function fakeClient(outcome: Anthropic.Message | Error): Anthropic {
  const finalMessage = () => (outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome));
  return { messages: { stream: () => ({ finalMessage }) } } as unknown as Anthropic;
}

describe("generateItinerary", () => {
  it("returns the validated itinerary with the token usage", async () => {
    const result = await generateItinerary(input, fakeClient(message()));
    expect(result.itinerary).toEqual(validItinerary);
    expect(result.model).toBe("claude-haiku-4-5-20251001");
    expect(result.usage).toEqual({ inputTokens: 1000, outputTokens: 3000 });
  });

  it("throws a retriable error when the tool input fails validation", async () => {
    const broken = message({ content: [toolUse({ ...validItinerary, days: [] })] });
    const failure = generateItinerary(input, fakeClient(broken));
    await expect(failure).rejects.toThrow(/failed validation/);
    await expect(failure).rejects.not.toBeInstanceOf(NonRetriableError);
  });

  it("throws a retriable error when the answer was cut by max_tokens", async () => {
    const failure = generateItinerary(input, fakeClient(message({ stop_reason: "max_tokens" })));
    await expect(failure).rejects.toThrow(/cut at/);
    await expect(failure).rejects.not.toBeInstanceOf(NonRetriableError);
  });

  it("does not retry a refusal", async () => {
    const failure = generateItinerary(input, fakeClient(message({ stop_reason: "refusal", content: [] })));
    await expect(failure).rejects.toBeInstanceOf(NonRetriableError);
  });

  it("does not retry a rejected request such as a bad API key", async () => {
    const rejected = new Anthropic.AuthenticationError(
      401,
      { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } },
      "invalid x-api-key",
      new Headers(),
    );
    const failure = generateItinerary(input, fakeClient(rejected));
    await expect(failure).rejects.toBeInstanceOf(NonRetriableError);
    await expect(failure).rejects.toThrow(/401/);
  });

  it("retries a server or network error", async () => {
    const outage = new Anthropic.InternalServerError(500, undefined, "overloaded", new Headers());
    await expect(generateItinerary(input, fakeClient(outage))).rejects.toBe(outage);
  });
});
