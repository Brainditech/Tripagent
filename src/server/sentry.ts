import * as Sentry from "@sentry/cloudflare";
import { wrapRequestHandler } from "@sentry/cloudflare/request";
import { runTask } from "expo-server";

// Sentry for the API routes. EAS Hosting runs them on Cloudflare Workers (its "worker runtime"),
// and Expo's dev server runs them in Node: the Cloudflare SDK fits both, since it only needs the
// standard `fetch` and `AsyncLocalStorage` from `node:async_hooks`, where the Node SDK would need
// its module hooks and OpenTelemetry. Expo owns the Worker entry, so the SDK's `withSentry` cannot
// wrap it: each route is wrapped instead (`wrapRequestHandler`), and the client is created once per
// process or isolate, then reused (`cacheClient`, the SDK's default).

// One isolation scope per request (user, request, conversation id); without this call, the scopes
// of concurrent requests would be shared.
Sentry.setAsyncLocalStorageAsyncContextStrategy();

/**
 * Same project as the app (`_layout.tsx`), so that one trace runs from the screen to Claude; `SENTRY_DSN`
 * sends the server elsewhere (another project, or a local sink to see what leaves). A DSN is not a secret.
 */
const DSN = "https://caadcf7440c1800b655d9c2626a0f7ab@o4512214175711232.ingest.de.sentry.io/4512215891837008";

const baseOptions: Sentry.CloudflareOptions = {
  dsn: process.env.SENTRY_DSN || DSN,
  environment: process.env.NODE_ENV === "production" ? "production" : "development",
  // Every trace is kept, as in the app: one production environment and a handful of users.
  tracesSampleRate: 1.0,
  // Every outgoing request goes to a third party (Anthropic, Neon, Clerk, Unsplash, ImageKit): trace headers to none of them.
  tracePropagationTargets: [],
  // Nothing personal leaves the server (ADR 0006): no IP address, cookie, header value or body, and
  // the prompts and replies stay out of the `gen_ai` spans, which keep the model, the tokens, the
  // latency and the stop reason. `genAI` is the one switch to read the conversations in Sentry.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    genAI: { inputs: false, outputs: false },
  },
  // `SENTRY_DEBUG=1` prints what the SDK does (spans, envelopes sent) in the dev server's terminal.
  debug: process.env.SENTRY_DEBUG === "1",
};

// The request wrapper alone sets up the integrations that work without `nodejs_compat`; both
// runtimes here have it, so the full set is asked for, as its documentation says.
const options: Sentry.CloudflareOptions = { ...baseOptions, defaultIntegrations: Sentry.getDefaultIntegrations(baseOptions) };

type RouteParams = Record<string, string>;
type RouteHandler = (request: Request, params: RouteParams) => Promise<Response>;
/** What Expo calls: the params are those of a dynamic route, absent otherwise. */
type Route = (request: Request, params?: RouteParams) => Promise<Response>;

/**
 * What the SDK needs from the Worker's execution context: `waitUntil` keeps the invocation alive
 * until the envelopes are sent, which happens once the response, or the last line of a streamed
 * one, has left. Expo does not hand the context to a route, but `runTask` (expo-server) reaches its
 * `waitUntil` on EAS Hosting; in the dev server the promise simply runs, and outside a request
 * (tests) it is left to itself.
 */
function executionContext() {
  return {
    waitUntil(promise: Promise<unknown>) {
      try {
        runTask(() => promise);
      } catch {
        void promise.catch(() => undefined);
      }
    },
    passThroughOnException() {},
  };
}

/**
 * Runs an API route under Sentry: one isolation scope per request, an `http.server` span that
 * continues the trace the app sends (`sentry-trace`, `baggage`), the request's method and path on
 * every event and log, errors the route lets through captured and rethrown, and a flush once the
 * response has left. The route's own 500s are captured by `toHttpError`.
 */
export function withSentry(handler: RouteHandler): Route {
  return (request, params = {}) =>
    wrapRequestHandler({ options, request, context: executionContext() }, () => handler(request, params));
}

/**
 * Traces every call of an Anthropic client as a `gen_ai.chat` span: model, token usage, latency,
 * stop reason, and the prompts and replies only where `dataCollection.genAI` allows (off above).
 * `messages.stream` is covered: the span ends with the final message, or with the stream's error,
 * which is also captured.
 */
export function instrumentAnthropic<T extends object>(client: T): T {
  return Sentry.instrumentAnthropicAiClient(client);
}
