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
