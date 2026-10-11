import { describe, expect, it, vi } from "vitest";

import { type ChatMessage, toHistory } from "@/lib/assistant";
import { MAX_HISTORY_MESSAGES } from "@/lib/assistant-rules";

// The lib runs in the app; only its pure part is under test (vi.mock is hoisted above the imports).
vi.mock("@sentry/react-native", () => ({ logger: { info: vi.fn() } }));

function turn(role: ChatMessage["role"], content: string, local = false): ChatMessage {
  return { id: content, role, content, at: 0, local };
}

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
