import { createClerkClient } from "@clerk/backend";

import { requireEnv } from "@/server/config";
import { HttpError, jsonError } from "@/server/http";

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
 * Wraps an API route handler: the Clerk JWT is verified before anything else,
 * an `HttpError` becomes its JSON response, and any other error is logged and
 * answered with a 500 that reveals nothing.
 */
export function authedRoute(handler: (context: AuthedContext) => Promise<Response>) {
  return async (request: Request, params: RouteParams = {}): Promise<Response> => {
    try {
      const { userId } = await requireUser(request);
      return await handler({ request, params, userId });
    } catch (error) {
      if (error instanceof HttpError) return error.toResponse();
      console.error(`[api] ${request.method} ${new URL(request.url).pathname} failed`, error);
      return jsonError(500, "internal_error", "Something went wrong.");
    }
  };
}
