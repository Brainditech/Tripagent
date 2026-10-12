import { eq } from "drizzle-orm";
import { z } from "zod";

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
 * follow-up suggestions.
 */
export const POST = authedRoute(async ({ request, userId }) => {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = assistantRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, "invalid_messages", z.prettifyError(parsed.error));
  }

  await ensureUser(userId);
  const [user] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, userId)).limit(1);

  // The response waits for Claude to accept the request: a rejected key, a rate limit or an outage
  // still answer with their status (422, 429, 503, 500). Only what fails once the answer has begun
  // is told on a last `error` line, since the status has left by then.
  const progress = answerTraveller({ messages: parsed.data.messages, locale: user.locale });
  try {
    await progress.next();
  } catch (error) {
    throw assistantHttpError(error) ?? error;
  }

  return jsonLinesResponse<AssistantStreamEvent>(async (send) => {
    try {
      for await (const event of progress) {
        if (event.type === "text") send(event);
        if (event.type === "answer") send({ type: "answer", ...(await withPhotos(event.result.answer)) });
      }
    } catch (error) {
      // The app stopped reading (new conversation, app closed): leaving the loop aborted the Claude request.
      if (error instanceof ClientGoneError) return;
      const { status, code, message } = assistantHttpError(error) ?? toHttpError(request, error);
      send({ type: "error", status, code, message });
    }
  });
});

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
