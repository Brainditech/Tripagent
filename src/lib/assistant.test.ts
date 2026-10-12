import * as Sentry from "@sentry/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type Api, ApiError } from "@/lib/api";
import { askAssistant, type ChatMessage, readJsonLines, toHistory } from "@/lib/assistant";
import { MAX_HISTORY_MESSAGES } from "@/lib/assistant-rules";

// The lib runs in the app; here its pure parts and its reading of the API's answer are under test
// (vi.mock is hoisted above the imports).
vi.mock("@clerk/expo", () => ({ useAuth: () => ({ getToken: async () => null }) }));
vi.mock("react", () => ({ useMemo: <T>(factory: () => T) => factory() }));
vi.mock("@sentry/react-native", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const info = vi.mocked(Sentry.logger.info);
const warn = vi.mocked(Sentry.logger.warn);
const error = vi.mocked(Sentry.logger.error);

function turn(role: ChatMessage["role"], content: string, local = false): ChatMessage {
  return { id: content, role, content, at: 0, local };
}

/** A response body delivered in the given chunks, as the network would. */
function bodyOf(chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      controller.close();
    },
  });
}

/** An API whose `stream` answers the given lines, one chunk each, the last one without its newline. */
function answering(lines: unknown[]): Api {
  const chunks = lines.map((line, index) => `${JSON.stringify(line)}${index < lines.length - 1 ? "\n" : ""}`);
  return { stream: async () => new Response(bodyOf(chunks)) } as unknown as Api;
}

const history = [{ role: "user" as const, content: "Où partir en avril ?" }];
const answer = { type: "answer", message: "Lisbonne.", destinations: [], suggestions: ["Quand ?", "Combien ?", "Comment ?"] };

describe("toHistory", () => {
  it("drops the welcome and keeps only role and content", () => {
    const messages = [turn("assistant", "Bonjour !", true), turn("user", "Où partir ?"), turn("assistant", "Lisbonne."), turn("user", "Pourquoi ?")];
    expect(toHistory(messages)).toEqual([
      { role: "user", content: "Où partir ?" },
      { role: "assistant", content: "Lisbonne." },
      { role: "user", content: "Pourquoi ?" },
    ]);
  });

  it("keeps the latest turns within the limit and starts the sent part with the traveller", () => {
    const messages = Array.from({ length: MAX_HISTORY_MESSAGES + 4 }, (_, i) =>
      turn(i % 2 === 0 ? "assistant" : "user", `m${i}`),
    );
    const history = toHistory(messages);
    expect(history.length).toBeLessThanOrEqual(MAX_HISTORY_MESSAGES);
    expect(history[0].role).toBe("user");
    expect(history[history.length - 1]).toEqual({ role: "user", content: `m${MAX_HISTORY_MESSAGES + 3}` });
  });
});

describe("readJsonLines", () => {
  it("gives each value once its line is complete, however the chunks fall", async () => {
    const seen: unknown[] = [];
    await readJsonLines(bodyOf(['{"a":1}\n{"b"', ':2}\n\n', '{"c":3}']), (line) => seen.push(line));
    expect(seen).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  it("decodes a character cut between two chunks", async () => {
    const bytes = new TextEncoder().encode('{"t":"é"}\n');
    const cut = bytes.indexOf(0xa9); // the second byte of "é"
    const seen: unknown[] = [];
    await readJsonLines(bodyOf([bytes.slice(0, cut), bytes.slice(cut)]), (line) => seen.push(line));
    expect(seen).toEqual([{ t: "é" }]);
  });
});

describe("askAssistant", () => {
  beforeEach(() => {
    info.mockClear();
    warn.mockClear();
    error.mockClear();
  });

  it("reports the reply as it is written, then returns the answer and logs its shape", async () => {
    const api = answering([{ type: "text", delta: "Lis" }, { type: "text", delta: "bonne." }, answer]);
    const onText = vi.fn();
    const reply = await askAssistant(api, history, { onText });
    expect(onText.mock.calls.map(([text]) => text)).toEqual(["Lis", "Lisbonne."]);
    expect(reply).toEqual({ message: "Lisbonne.", destinations: [], suggestions: answer.suggestions });
    expect(info).toHaveBeenCalledWith(
      "Assistant answered",
      expect.objectContaining({ turns: 1, destinations: 0, suggestions: 3, first_text_ms: expect.any(Number), duration_ms: expect.any(Number) }),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("throws the error told on the last line as an ApiError, logged once as the client would", async () => {
    const api = answering([{ type: "text", delta: "Je" }, { type: "error", status: 422, code: "assistant_refused", message: "No." }]);
    await expect(askAssistant(api, history)).rejects.toMatchObject({ status: 422, code: "assistant_refused" });
    expect(warn).toHaveBeenCalledWith("Assistant answer failed", expect.objectContaining({ status: 422, code: "assistant_refused", turns: 1 }));
    expect(error).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it("throws, as an error, an answer cut before its last line", async () => {
    const api = answering([{ type: "text", delta: "Je" }]);
    const failure = await askAssistant(api, history).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(ApiError);
    expect(error).toHaveBeenCalledWith("Assistant answer failed", expect.objectContaining({ status: null, message: expect.stringMatching(/last line/) }));
  });

  it("says nothing when the traveller gave the request up", async () => {
    const controller = new AbortController();
    const body = new ReadableStream<Uint8Array>({
      pull(stream) {
        controller.abort();
        stream.error(new DOMException("The operation was aborted.", "AbortError"));
      },
    });
    const api = { stream: async () => new Response(body) } as unknown as Api;
    await expect(askAssistant(api, history, { signal: controller.signal })).rejects.toThrow(/aborted/);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
