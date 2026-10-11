import { eq } from "drizzle-orm";
import { z } from "zod";

import { answerTraveller, assistantHttpError, assistantRequestSchema } from "@/server/ai/assistant";
import { authedRoute } from "@/server/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { HttpError } from "@/server/http";
import { cachedPhoto } from "@/server/unsplash";
import { ensureUser } from "@/server/users";

/**
 * One turn of the travel chat. The conversation comes with the request and nothing is stored:
 * the app keeps it for the session. Claude answers in the user's language, and each destination
 * it suggests gets an Unsplash photo (hotlinked, credited by the app), or none when Unsplash
 * has nothing: a card without photo is better than a failed answer.
 */
export const POST = authedRoute(async ({ request, userId }) => {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = assistantRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, "invalid_messages", z.prettifyError(parsed.error));
  }

  await ensureUser(userId);
  const [user] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, userId)).limit(1);

  let answer;
  try {
    ({ answer } = await answerTraveller({ messages: parsed.data.messages, locale: user.locale }));
  } catch (error) {
    throw assistantHttpError(error) ?? error;
  }

  // The full name first ("Chiang Mai, Thailand"); the city alone when that finds nothing, which
  // happens with a country written in the user's language.
  const photos = await Promise.all(
    answer.destinations.map(
      async (destination) =>
        (await cachedPhoto(`${destination.name}, ${destination.country}`)) ?? (await cachedPhoto(destination.name)),
    ),
  );
  return Response.json({
    message: answer.message,
    destinations: answer.destinations.map((destination, index) => ({ ...destination, photo: photos[index] })),
    suggestions: answer.suggestions,
  });
});
