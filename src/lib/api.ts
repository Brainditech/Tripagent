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
  /**
   * POSTs and returns the response as soon as its headers arrive, for routes that answer line by
   * line while they work (`response.body` is read by the caller). A rejected request throws an
   * `ApiError` like the other calls; `signal` gives the request up, without a log.
   */
  stream(path: string, body: unknown, signal?: AbortSignal): Promise<Response>;
};

type TokenGetter = () => Promise<string | null>;

/**
 * The path as the logs carry it, with nothing a request could have put there: the query string
 * and the fragment are dropped, the trip id (from the route params, so from any deep link) is
 * replaced by `[id]` whatever it holds, and so is any other segment that is not a plain route
 * word, for the routes to come: `/api/trips/[id]/cover`, `/api/trips/[id]/versions/[id]`.
 */
function routeOf(path: string): string {
  const segments = path.split(/[?#]/, 1)[0].split("/");
  return segments
    .map((segment, index) => {
      const isTripId = index === 3 && segments[2] === "trips";
      return isTripId || !/^[a-z-]*$/.test(segment) ? "[id]" : segment;
    })
    .join("/");
}

type RequestOptions = { body?: unknown; accept: string; signal?: AbortSignal };

/**
 * Fetch wrapper for the app's own API routes. Paths are relative (`/api/...`):
 * in development they reach the dev server, in production the `origin` of the
 * expo-router plugin. Every request carries the Clerk session token.
 */
export function createApi(getToken: TokenGetter, fetchImpl: typeof fetch = fetch): Api {
  /** Sends the request and returns its response once accepted (2xx); anything else throws. */
  async function request(method: string, path: string, { body, accept, signal }: RequestOptions): Promise<Response> {
    const token = await getToken();
    const headers: Record<string, string> = { Accept: accept };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    // Every failed request is logged here, once, with what the screens cannot show: the route,
    // the status, the API's error code and how long the attempt took.
    const route = routeOf(path);
    const startedAt = Date.now();
    let response: Response;
    try {
      response = await fetchImpl(path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (error) {
      // Given up by the caller: nothing went wrong.
      if (signal?.aborted) throw error;
      // No answer at all (offline, DNS, timeout): the screens say "check your connection".
      Sentry.logger.warn("API request got no answer", {
        method,
        route,
        has_token: Boolean(token),
        message: errorMessage(error),
        duration_ms: Date.now() - startedAt,
      });
      throw error;
    }
    if (response.ok) return response;

    const data: unknown = await response.json().catch(() => null);
    const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
    const code = error?.code ?? "http_error";
    const message = error?.message ?? `HTTP ${response.status}`;
    // A server fault is an error; a refusal (401, 404, 429, invalid body) is a warning.
    const log = response.status >= 500 ? Sentry.logger.error : Sentry.logger.warn;
    log("API request rejected", {
      method,
      route,
      status: response.status,
      code,
      message,
      has_token: Boolean(token),
      duration_ms: Date.now() - startedAt,
    });
    throw new ApiError(response.status, code, message);
  }

  /** A request answered with JSON, or with nothing (204). */
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await request(method, path, { body, accept: "application/json" });
    if (response.status === 204) return undefined as T;
    return (await response.json().catch(() => null)) as T;
  }

  return {
    get: (path) => call("GET", path),
    post: (path, body) => call("POST", path, body),
    put: (path, body) => call("PUT", path, body),
    delete: (path) => call("DELETE", path),
    stream: (path, body, signal) => request("POST", path, { body, accept: "application/x-ndjson, application/json", signal }),
  };
}

/** The API client of the signed-in user. */
export function useApi(): Api {
  const { getToken } = useAuth();
  return useMemo(() => createApi(getToken), [getToken]);
}
