import * as Sentry from "@sentry/cloudflare";

/** Body of every error response: `{ error: { code, message } }`. */
export function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

/** An error that an API route turns into a JSON response with the given status. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }

  toResponse(): Response {
    return jsonError(this.status, this.code, this.message);
  }
}

/**
 * The error a route answers with: an `HttpError` as it is; anything else is logged with the
 * route (EAS Hosting keeps the console), captured as a Sentry issue (the request's scope carries
 * the route and the user) and becomes a 500 that reveals nothing.
 */
export function toHttpError(request: Request, error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  console.error(`[api] ${request.method} ${new URL(request.url).pathname} failed`, error);
  Sentry.captureException(error);
  return new HttpError(500, "internal_error", "Something went wrong.");
}

/** Content type of a response made of JSON lines (NDJSON): one JSON value per line, sent as it is ready. */
export const JSON_LINES_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";

/** Thrown by `send` once the client has stopped reading, so that the producer stops its work. */
export class ClientGoneError extends Error {
  constructor() {
    super("The client stopped reading the response");
    this.name = "ClientGoneError";
  }
}

/**
 * A response written line by line while `produce` runs: each `send` appends one JSON value and a
 * newline, the body closes when `produce` returns and fails when it throws. The status and the
 * headers leave at once, so what fails after the first line has to be told on a line of its own.
 * Once the client has gone (connection closed, request given up), `signal` aborts at once, so that
 * `produce` can cancel what it is waiting for (an upstream request), and `send` throws
 * `ClientGoneError`, so that `produce` stops rather than finish an answer nobody reads.
 */
export function jsonLinesResponse<T>(produce: (send: (line: T) => void, signal: AbortSignal) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const clientGone = new AbortController();
  let open = true;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (line: T) => {
        if (!open) throw new ClientGoneError();
        controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      };
      produce(send, clientGone.signal).then(
        () => {
          if (!open) return;
          open = false;
          controller.close();
        },
        (error: unknown) => {
          if (!open) return;
          open = false;
          controller.error(error);
        },
      );
    },
    cancel() {
      open = false;
      clientGone.abort(new ClientGoneError());
    },
  });
  return new Response(body, {
    headers: { "Content-Type": JSON_LINES_CONTENT_TYPE, "Cache-Control": "no-store" },
  });
}
