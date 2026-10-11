import { ClerkAPIResponseError } from "@clerk/backend/errors";
import { describe, expect, it, vi } from "vitest";

import { HttpError } from "@/server/http";
import { ensureUser } from "@/server/users";

// Both the database and Clerk are stubbed: `ensureUser` is tested on what it does
// with their answers (`vi.mock` is hoisted above the imports, hence `vi.hoisted`).
const { getUser, select, execute } = vi.hoisted(() => ({ getUser: vi.fn(), select: vi.fn(), execute: vi.fn() }));
vi.mock("@/server/auth", () => ({ clerkClient: () => ({ users: { getUser } }) }));
vi.mock("@/server/db", () => ({
  db: { select: (...args: unknown[]) => select(...args), execute: (...args: unknown[]) => execute(...args) },
}));

/** `db.select(...).from(...).where(...).limit(1)` resolving to `rows`. */
function selectAnswering(rows: unknown[]) {
  select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => rows }) }) });
}

const clerkUser = {
  id: "user_1",
  primaryEmailAddressId: "email_1",
  emailAddresses: [{ id: "email_1", emailAddress: "jane@example.com" }],
  firstName: "Jane",
  lastName: "Doe",
  updatedAt: 1760000000000,
};

async function failure(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
    return undefined;
  } catch (error) {
    return error;
  }
}

describe("ensureUser", () => {
  it("does nothing when the row exists", async () => {
    selectAnswering([{ id: "user_1" }]);
    getUser.mockReset();
    await ensureUser("user_1");
    expect(getUser).not.toHaveBeenCalled();
  });

  it("creates the row from Clerk when it is missing", async () => {
    selectAnswering([]);
    getUser.mockResolvedValue(clerkUser);
    execute.mockResolvedValue({ rows: [{ id: "user_1" }] });
    await expect(ensureUser("user_1")).resolves.toBeUndefined();
    expect(getUser).toHaveBeenCalledWith("user_1");
  });

  it("answers 403 when the account was deleted after the session token was issued", async () => {
    selectAnswering([]);
    getUser.mockResolvedValue(clerkUser);
    // The deletion trace is newer than the account: the stale-proof upsert writes nothing.
    execute.mockResolvedValue({ rows: [] });
    const error = await failure(() => ensureUser("user_1"));
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(403);
    expect((error as HttpError).code).toBe("account_deleted");
  });

  it("answers 403 when Clerk no longer knows the account", async () => {
    selectAnswering([]);
    getUser.mockRejectedValue(new ClerkAPIResponseError("Not Found", { status: 404, data: [] }));
    const error = await failure(() => ensureUser("user_1"));
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(403);
  });

  it("lets any other Clerk error through as a 500", async () => {
    selectAnswering([]);
    getUser.mockRejectedValue(new ClerkAPIResponseError("Server Error", { status: 500, data: [] }));
    const error = await failure(() => ensureUser("user_1"));
    expect(error).not.toBeInstanceOf(HttpError);
  });
});
