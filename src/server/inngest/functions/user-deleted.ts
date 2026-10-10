import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { inngest } from "@/server/inngest/client";
import { userDeletedEvent } from "@/server/inngest/events";

/**
 * Removes what a deleted Clerk account left behind. For now that is the `users`
 * row (the later tables cascade from it); the ImageKit files are removed here
 * once uploads exist. Safe to re-run: deleting a missing row is a no-op.
 */
export const userDeleted = inngest.createFunction(
  { id: "user-deleted", name: "Delete a user's data", triggers: [userDeletedEvent] },
  async ({ event, step }) => {
    const { userId } = event.data;
    const deletedRows = await step.run("delete-users-row", async () =>
      db.delete(users).where(eq(users.id, userId)).returning({ id: users.id }),
    );
    return { userId, deletedRows: deletedRows.length };
  },
);
