import Anthropic from "@anthropic-ai/sdk";
import { NonRetriableError } from "inngest";
import { z } from "zod";

import { itineraryPrompt, type ItineraryInput, SYSTEM_PROMPT } from "@/server/ai/prompts";
import { type Itinerary, itinerarySchema, itineraryToolSchema } from "@/server/ai/schema";
import { config, requireEnv } from "@/server/config";

/** Room for a 10-day trip with 5 activities a day; streaming keeps the request clear of HTTP timeouts. */
const MAX_OUTPUT_TOKENS = 24_000;

const ITINERARY_TOOL: Anthropic.Tool = {
  name: "save_itinerary",
  description: "Saves the complete trip: title, summary, one entry per day with activities, hotels, budget and tips.",
  strict: true,
  input_schema: itineraryToolSchema as Anthropic.Tool.InputSchema,
};

export type GenerationResult = {
  itinerary: Itinerary;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
};

/** The SDK client is built on first use, so that a missing key fails the step and not the import. */
function defaultClient(): Anthropic {
  return new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
}

/**
 * Asks Claude for a trip through the `save_itinerary` tool (forced, strict), then
 * validates the tool input with Zod. A validation failure or a truncated answer
 * throws a plain error, so the Inngest step retries; a rejected request (bad key,
 * unknown model, refusal) throws a `NonRetriableError`, since retrying cannot help.
 */
export async function generateItinerary(
  input: ItineraryInput,
  client: Anthropic = defaultClient(),
): Promise<GenerationResult> {
  let message: Anthropic.Message;
  try {
    message = await client.messages
      .stream({
        model: config.aiModel,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: itineraryPrompt(input) }],
        tools: [ITINERARY_TOOL],
        tool_choice: { type: "tool", name: ITINERARY_TOOL.name },
      })
      .finalMessage();
  } catch (error) {
    if (
      error instanceof Anthropic.AuthenticationError ||
      error instanceof Anthropic.PermissionDeniedError ||
      error instanceof Anthropic.BadRequestError ||
      error instanceof Anthropic.NotFoundError
    ) {
      throw new NonRetriableError(`Claude rejected the request (${error.status}): ${error.message}`, { cause: error });
    }
    throw error;
  }

  if (message.stop_reason === "max_tokens") {
    throw new Error(`Claude's answer was cut at ${MAX_OUTPUT_TOKENS} output tokens`);
  }
  if (message.stop_reason === "refusal") {
    throw new NonRetriableError("Claude declined to plan this trip");
  }

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === ITINERARY_TOOL.name,
  );
  if (!toolUse) {
    throw new Error(`Claude did not call ${ITINERARY_TOOL.name} (stop reason: ${message.stop_reason})`);
  }

  const parsed = itinerarySchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(`The itinerary failed validation: ${z.prettifyError(parsed.error)}`);
  }

  return {
    itinerary: parsed.data,
    model: message.model,
    usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
  };
}
