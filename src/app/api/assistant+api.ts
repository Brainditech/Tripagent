import * as Sentry from "@sentry/cloudflare";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { errorMessage } from "@/lib/errors";
import {
  answerTraveller,
  type AssistantAnswer,
  type AssistantDestination,
  assistantHttpError,
  assistantRequestSchema,
  type AssistantStreamEvent,
} from "@/server/ai/assistant";
import { authedRoute } from "@/server/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { ClientGoneError, HttpError, jsonLinesResponse, toHttpError } from "@/server/http";
import { cachedPhoto } from "@/server/unsplash";
import { ensureUser } from "@/server/users";

/**
 * One turn of the travel chat. The conversation comes with the request and nothing is stored:
 * the app keeps it for the session. Claude answers in the user's language, and the reply goes out
 * as it is written, one JSON line per piece of text, then a last line with the whole answer: its
 * text, the destination cards with their Unsplash photos (hotlinked, credited by the app) and the
 * follow-up suggestions. Sentry gets the Claude call as a `gen_ai` span (model, tokens, latency,
 * never the text) under the conversation id the app sends, one log line per turn answered or
 * failed, and the route's own failures as issues.
 */
export const POST = authedRoute(async ({ request, userId }) => {
  const startedAt = Date.now();
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = assistantRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, "invalid_messages", z.prettifyError(parsed.error));
  }
  const { messages, conversationId } = parsed.data;
  // Every `gen_ai` span of the conversation shares the id the app made when it began, which is
  // what groups its turns in Sentry's Conversations view.
  if (conversationId) Sentry.setConversationId(conversationId);

  await ensureUser(userId);
  const [user] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, userId)).limit(1);

  // The response waits for Claude to accept the request: a rejected key, a rate limit or an outage
  // still answer with their status (422, 429, 503, 500). Only what fails once the answer has begun
  // is told on a last `error` line, since the status has left by then.
  const progress = answerTraveller({ messages, locale: user.locale });
  try {
    await progress.next();
  } catch (error) {
    const known = assistantHttpError(error);
    if (known) logFailure("before_start", known, error, messages.length, startedAt);
    throw known ?? error;
  }

  let firstTextAt: number | null = null;
  return jsonLinesResponse<AssistantStreamEvent>(async (send) => {
    try {
      for await (const event of progress) {
        if (event.type === "text") {
          firstTextAt ??= Date.now();
          send(event);
        }
        if (event.type === "answer") {
          const answer = await withPhotos(event.result.answer);
          send({ type: "answer", ...answer });
          Sentry.logger.info("Assistant turn answered", {
            turns: messages.length,
            destinations: answer.destinations.length,
            photos: answer.destinations.filter((destination) => destination.photo).length,
            suggestions: answer.suggestions.length,
            model: event.result.model,
            input_tokens: event.result.usage.inputTokens,
            output_tokens: event.result.usage.outputTokens,
            locale: user.locale,
            first_text_ms: firstTextAt === null ? null : firstTextAt - startedAt,
            duration_ms: Date.now() - startedAt,
          });
        }
      }
    } catch (error) {
      // The app stopped reading (new conversation, app closed): leaving the loop aborted the Claude request.
      if (error instanceof ClientGoneError) return;
      const known = assistantHttpError(error);
      if (known) logFailure("streaming", known, error, messages.length, startedAt);
      const { status, code, message } = known ?? toHttpError(request, error);
      send({ type: "error", status, code, message });
    }
  });
});

/**
 * One warning per answer Claude could not give (refusal, busy, outage, unusable reply), with its
 * cause and never the text. A failure of the route itself goes through `toHttpError` instead,
 * which captures it as an issue.
 */
function logFailure(phase: "before_start" | "streaming", error: HttpError, cause: unknown, turns: number, startedAt: number) {
  Sentry.logger.warn("Assistant turn failed", {
    phase,
    status: error.status,
    code: error.code,
    cause: errorMessage(cause),
    turns,
    duration_ms: Date.now() - startedAt,
  });
}

/**
 * The answer with a photo on each card, or none when Unsplash has nothing: a card without photo
 * is better than a failed answer. The full name first ("Chiang Mai, Thailand"); the city alone
 * when that finds nothing, which happens with a country written in the user's language.
 */
async function withPhotos(answer: AssistantAnswer): Promise<Omit<Extract<AssistantStreamEvent, { type: "answer" }>, "type">> {
  const destinations: AssistantDestination[] = await Promise.all(
    answer.destinations.map(async (destination) => ({
      ...destination,
      photo: (await cachedPhoto(`${destination.name}, ${destination.country}`)) ?? (await cachedPhoto(destination.name)),
    })),
  );
  return { message: answer.message, destinations, suggestions: answer.suggestions };
}
