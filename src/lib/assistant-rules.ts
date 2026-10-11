// Limits of the travel chat, shared by the app (what the composer accepts, what is sent) and the
// server (what `POST /api/assistant` refuses). The chat is stateless: the app sends the
// conversation with every request, so both sides bound its size.

/** Longest message a traveller can send. */
export const MAX_MESSAGE_LENGTH = 2000;

/** Most turns sent with one request; older ones are left behind. */
export const MAX_HISTORY_MESSAGES = 30;

/** Most destination cards in one answer. */
export const MAX_DESTINATIONS = 4;

/** Most follow-up suggestions under one answer. */
export const MAX_SUGGESTIONS = 3;
