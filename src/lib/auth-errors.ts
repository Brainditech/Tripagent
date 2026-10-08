import { isClerkAPIResponseError } from "@clerk/expo";

// French messages for the Clerk error codes the email-code flow can return (moves to i18n in Phase 6).
const MESSAGES: Record<string, string> = {
  form_param_format_invalid: "Cette adresse e-mail n’est pas valide.",
  form_param_missing: "Saisissez votre adresse e-mail.",
  form_code_incorrect: "Code incorrect. Vérifiez-le et réessayez.",
  verification_expired: "Ce code a expiré. Demandez-en un nouveau.",
  verification_failed: "Trop de tentatives avec ce code. Demandez-en un nouveau.",
  too_many_requests: "Trop de demandes. Réessayez dans quelques minutes.",
  user_locked: "Compte temporairement bloqué après trop de tentatives. Réessayez plus tard.",
};

const FALLBACK = "Une erreur est survenue. Réessayez.";

/** The Clerk error code (e.g. `form_identifier_not_found`), if any. */
export function clerkErrorCode(error: unknown): string | undefined {
  if (isClerkAPIResponseError(error)) return error.errors[0]?.code;
  if (error instanceof Error && "code" in error && typeof error.code === "string") return error.code;
  return undefined;
}

/** A user-facing French message for a Clerk error. */
export function authErrorMessage(error: unknown): string {
  const code = clerkErrorCode(error);
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (isClerkAPIResponseError(error)) return error.errors[0]?.longMessage ?? FALLBACK;
  return FALLBACK;
}
