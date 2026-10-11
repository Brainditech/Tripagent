import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { deleteFolder, userCoverFolder } from "@/server/imagekit";
import { inngest } from "@/server/inngest/client";
import { userDeletedEvent } from "@/server/inngest/events";

/**
 * Removes what a deleted Clerk account left behind: the `users` row (the later
 * tables cascade from it) and the user's cover folder at ImageKit. Safe to re-run:
 * deleting a missing row or folder is a no-op.
 */
export const userDeleted = inngest.createFunction(
  { id: "user-deleted", name: "Delete a user's data", triggers: [userDeletedEvent] },
  async ({ event, step }) => {
    const { userId } = event.data;
    const deletedRows = await step.run("delete-users-row", async () =>
      db.delete(users).where(eq(users.id, userId)).returning({ id: users.id }),
    );
    await step.run("delete-cover-folder", async () => {
      await deleteFolder(userCoverFolder(userId));
    });
    return { userId, deletedRows: deletedRows.length };
  },
);
