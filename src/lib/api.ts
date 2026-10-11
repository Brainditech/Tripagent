import { useAuth } from "@clerk/expo";
import * as Sentry from "@sentry/react-native";
import { useMemo } from "react";

import { errorMessage } from "@/lib/errors";

/** An error answered by the API: `{ error: { code, message } }` with its HTTP status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type Api = {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
  delete(path: string): Promise<void>;
};

type TokenGetter = () => Promise<string | null>;

/**
 * Fetch wrapper for the app's own API routes. Paths are relative (`/api/...`):
 * in development they reach the dev server, in production the `origin` of the
 * expo-router plugin. Every request carries the Clerk session token.
 */
export function createApi(getToken: TokenGetter, fetchImpl: typeof fetch = fetch): Api {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await getToken();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    // Every failed request is logged here, once, with what the screens cannot show: the status,
    // the API's error code and how long the attempt took.
    const startedAt = Date.now();
    let response: Response;
    try {
      response = await fetchImpl(path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      // No answer at all (offline, DNS, timeout): the screens say "check your connection".
      Sentry.logger.warn("API request got no answer", {
        method,
        path,
        has_token: Boolean(token),
        message: errorMessage(error),
        duration_ms: Date.now() - startedAt,
      });
      throw error;
    }
    if (response.status === 204) return undefined as T;

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
      const code = error?.code ?? "http_error";
      const message = error?.message ?? `HTTP ${response.status}`;
      // A server fault is an error; a refusal (401, 404, 429, invalid body) is a warning.
      const log = response.status >= 500 ? Sentry.logger.error : Sentry.logger.warn;
      log("API request rejected", {
        method,
        path,
        status: response.status,
        code,
        message,
        has_token: Boolean(token),
        duration_ms: Date.now() - startedAt,
      });
      throw new ApiError(response.status, code, message);
    }
    return data as T;
  }

  return {
    get: (path) => call("GET", path),
    post: (path, body) => call("POST", path, body),
    put: (path, body) => call("PUT", path, body),
    delete: (path) => call("DELETE", path),
  };
}

/** The API client of the signed-in user. */
export function useApi(): Api {
  const { getToken } = useAuth();
  return useMemo(() => createApi(getToken), [getToken]);
}
