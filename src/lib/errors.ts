/** The message of a caught value, whatever was thrown (an `Error`, a string, anything else). */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
