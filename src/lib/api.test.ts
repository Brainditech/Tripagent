import * as Sentry from "@sentry/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, createApi } from "@/lib/api";

// The client runs in the app; here only its request logic is under test (vi.mock is hoisted above the imports).
vi.mock("@clerk/expo", () => ({ useAuth: () => ({ getToken: async () => null }) }));
vi.mock("react", () => ({ useMemo: <T>(factory: () => T) => factory() }));
vi.mock("@sentry/react-native", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

const warn = vi.mocked(Sentry.logger.warn);
const error = vi.mocked(Sentry.logger.error);

function answering(status: number, body: unknown = null): typeof fetch {
  return vi.fn(async () => new Response(body === null ? null : JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("createApi", () => {
  beforeEach(() => {
    warn.mockClear();
    error.mockClear();
  });

  it("returns the JSON of a 2xx answer, without logging", async () => {
    const api = createApi(async () => "token", answering(200, { ok: true }));
    await expect(api.get("/api/me")).resolves.toEqual({ ok: true });
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("logs a 4xx as a warning, with the trip id masked in the route", async () => {
    const api = createApi(async () => "token", answering(404, { error: { code: "not_found", message: "No such trip" } }));
    await expect(api.get("/api/trips/not-a-real-id/status")).rejects.toMatchObject({ status: 404, code: "not_found" });
    expect(warn).toHaveBeenCalledWith(
      "API request rejected",
      expect.objectContaining({ method: "GET", route: "/api/trips/[id]/status", status: 404, code: "not_found", has_token: true }),
    );
    expect(error).not.toHaveBeenCalled();
  });

  it("keeps neither the query string, the fragment nor any id-like segment in the route", async () => {
    const api = createApi(async () => "token", answering(404));
    await expect(api.get("/api/trips/abc/versions/7?token=secret#frag")).rejects.toBeInstanceOf(ApiError);
    expect(warn).toHaveBeenCalledWith(
      "API request rejected",
      expect.objectContaining({ route: "/api/trips/[id]/versions/[id]" }),
    );
    const plain = createApi(async () => "token", answering(404));
    await expect(plain.get("/api/me")).rejects.toBeInstanceOf(ApiError);
    expect(warn).toHaveBeenLastCalledWith("API request rejected", expect.objectContaining({ route: "/api/me" }));
  });

  it("logs a 5xx as an error and falls back to a generic code", async () => {
    const api = createApi(async () => null, answering(502));
    const failure = await api.post("/api/trips", {}).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect(error).toHaveBeenCalledWith(
      "API request rejected",
      expect.objectContaining({ method: "POST", route: "/api/trips", status: 502, code: "http_error", has_token: false }),
    );
  });

  it("logs a request that got no answer as a warning, then rethrows", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;
    const api = createApi(async () => "token", offline);
    await expect(api.delete("/api/trips/123")).rejects.toThrow("Network request failed");
    expect(warn).toHaveBeenCalledWith(
      "API request got no answer",
      expect.objectContaining({ method: "DELETE", route: "/api/trips/[id]", message: "Network request failed" }),
    );
  });
});
