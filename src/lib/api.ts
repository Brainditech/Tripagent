import { useAuth } from "@clerk/expo";
import { useMemo } from "react";

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

    const response = await fetchImpl(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 204) return undefined as T;

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
      throw new ApiError(response.status, error?.code ?? "http_error", error?.message ?? `HTTP ${response.status}`);
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
