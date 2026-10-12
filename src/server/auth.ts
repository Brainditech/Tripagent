import { createClerkClient } from "@clerk/backend";
import * as Sentry from "@sentry/cloudflare";

import { requireEnv } from "@/server/config";
import { HttpError, toHttpError } from "@/server/http";
import { withSentry } from "@/server/sentry";

let client: ReturnType<typeof createClerkClient> | undefined;

/** Clerk Backend client, created on first use so that the secret is only read then. */
export function clerkClient() {
  client ??= createClerkClient({
    secretKey: requireEnv("CLERK_SECRET_KEY"),
    publishableKey: requireEnv("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY"),
  });
  return client;
}

/**
 * Verifies the Clerk session token sent by the app as `Authorization: Bearer <token>`
 * and returns the Clerk user id. Anything else is a 401.
 */
export async function requireUser(request: Request): Promise<{ userId: string }> {
  const state = await clerkClient().authenticateRequest(request, { acceptsToken: "session_token" });
  if (!state.isAuthenticated) {
    throw new HttpError(401, "unauthorized", "Sign in to continue.");
  }
  return { userId: state.toAuth().userId };
}

type RouteParams = Record<string, string>;
type AuthedContext = { request: Request; params: RouteParams; userId: string };

/**
 * Wraps an API route handler: the request runs under Sentry (`withSentry`), the Clerk JWT is
 * verified before anything else and the user id is put on the request's scope, an `HttpError`
 * becomes its JSON response, and any other error is logged, captured and answered with a 500
 * that reveals nothing (`toHttpError`).
 */
export function authedRoute(handler: (context: AuthedContext) => Promise<Response>) {
  return withSentry(async (request, params) => {
    try {
      const { userId } = await requireUser(request);
      // The Clerk id, and nothing else, on the request's events, logs and `gen_ai` spans (the User
      // column of Sentry's Conversations).
      Sentry.setUser({ id: userId });
      return await handler({ request, params, userId });
    } catch (error) {
      return toHttpError(request, error).toResponse();
    }
  });
}
