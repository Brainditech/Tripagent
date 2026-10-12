import { wrapRequestHandler } from "@sentry/cloudflare/request";
import { describe, expect, it, vi } from "vitest";

import { instrumentAnthropic, withSentry } from "@/server/sentry";

// The SDK's request wrapper is replaced: under test is what the routes hand it (the request, the
// options, an execution context) and how the Anthropic client is wrapped (vi.mock is hoisted).
vi.mock("@sentry/cloudflare/request", () => ({
  wrapRequestHandler: vi.fn((_options: unknown, handler: () => Promise<Response>) => handler()),
}));

const wrap = vi.mocked(wrapRequestHandler);

describe("withSentry", () => {
  it("runs the route through the SDK's request wrapper, with the request, the options and an execution context", async () => {
    const request = new Request("http://localhost/api/trips/42");
    const handler = vi.fn(async (_request: Request, params: Record<string, string>) => Response.json({ id: params.id }));
    const response = await withSentry(handler)(request, { id: "42" });
    expect(handler).toHaveBeenCalledWith(request, { id: "42" });
    expect(await response.json()).toEqual({ id: "42" });

    const [wrapperOptions] = wrap.mock.calls[0]!;
    expect(wrapperOptions.request).toBe(request);
    expect(wrapperOptions.options.dsn).toMatch(/^https:\/\/\w+@o\d+\.ingest\.de\.sentry\.io\/\d+$/);
    expect(wrapperOptions.options).toMatchObject({
      tracesSampleRate: 1.0,
      tracePropagationTargets: [],
      dataCollection: { userInfo: false, httpBodies: [], genAI: { inputs: false, outputs: false } },
    });
    expect(typeof wrapperOptions.context?.waitUntil).toBe("function");
  });

  it("gives the route empty params when Expo sends none", async () => {
    const handler = vi.fn(async () => new Response());
    await withSentry(handler)(new Request("http://localhost/api/me"));
    expect(handler).toHaveBeenCalledWith(expect.any(Request), {});
  });

  it("lets a flush promise handed over outside a request run on its own, even when it fails", async () => {
    await withSentry(async () => new Response())(new Request("http://localhost/api/me"));
    const context = wrap.mock.calls.at(-1)![0].context!;
    let settled = false;
    const flush = Promise.reject(new Error("flush failed")).finally(() => {
      settled = true;
    });
    expect(() => context.waitUntil(flush)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(true);
  });
});

describe("instrumentAnthropic", () => {
  it("wraps messages.stream in place and keeps the stream the SDK returns", () => {
    const stream = { on: vi.fn() };
    const original = vi.fn((_params: unknown) => stream);
    const client = { messages: { stream: original } };
    expect(instrumentAnthropic(client)).toBe(client);
    expect(client.messages.stream).not.toBe(original);

    const params = { model: "claude-haiku-4-5-20251001", max_tokens: 10, messages: [] };
    expect(client.messages.stream(params)).toBe(stream);
    expect(original).toHaveBeenCalledWith(params);
    expect(stream.on.mock.calls.map(([event]) => event)).toEqual(expect.arrayContaining(["streamEvent", "message", "error"]));
  });
});
