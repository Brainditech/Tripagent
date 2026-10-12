import * as Sentry from "@sentry/cloudflare";
import { describe, expect, it, vi } from "vitest";

import { ClientGoneError, HttpError, JSON_LINES_CONTENT_TYPE, jsonLinesResponse, toHttpError } from "@/server/http";

// Only the capture matters here; nothing must reach Sentry from the tests (vi.mock is hoisted).
vi.mock("@sentry/cloudflare", () => ({ captureException: vi.fn() }));

describe("jsonLinesResponse", () => {
  it("writes one JSON value per line as they are sent, then closes the body", async () => {
    const response = jsonLinesResponse<{ n: number }>(async (send) => {
      send({ n: 1 });
      await Promise.resolve();
      send({ n: 2 });
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(JSON_LINES_CONTENT_TYPE);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe('{"n":1}\n{"n":2}\n');
  });

  it("fails the body when the producer throws", async () => {
    const response = jsonLinesResponse(async () => {
      throw new Error("boom");
    });
    await expect(response.text()).rejects.toThrow("boom");
  });

  it("tells the producer, at its next line, that the client has gone", async () => {
    let seen: unknown;
    let release!: () => void;
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const finished = new Promise<void>((resolve) => (finish = resolve));
    const response = jsonLinesResponse<string>(async (send) => {
      send("first");
      await gate;
      try {
        send("second");
      } catch (error) {
        seen = error;
      }
      finish();
    });
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('"first"\n');
    await reader.cancel();
    release();
    await finished;
    expect(seen).toBeInstanceOf(ClientGoneError);
  });

  it("aborts the producer's signal as soon as the client goes, without waiting for a line", async () => {
    let clientGone!: AbortSignal;
    const response = jsonLinesResponse<string>(async (send, signal) => {
      clientGone = signal;
      send("first");
      await new Promise((resolve) => signal.addEventListener("abort", resolve));
    });
    const reader = response.body!.getReader();
    await reader.read();
    expect(clientGone.aborted).toBe(false);
    await reader.cancel();
    expect(clientGone.aborted).toBe(true);
    expect(clientGone.reason).toBeInstanceOf(ClientGoneError);
  });
});

describe("toHttpError", () => {
  it("keeps an HttpError as it is", () => {
    const request = new Request("http://localhost/api/assistant", { method: "POST" });
    const known = new HttpError(422, "assistant_refused", "No.");
    expect(toHttpError(request, known)).toBe(known);
  });

  it("logs anything else with the route, captures it and answers a 500 that reveals nothing", () => {
    const request = new Request("http://localhost/api/assistant?x=1", { method: "POST" });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("boom");
    expect(toHttpError(request, error)).toMatchObject({ status: 500, code: "internal_error", message: "Something went wrong." });
    expect(log).toHaveBeenCalledWith("[api] POST /api/assistant failed", error);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    log.mockRestore();
  });
});
