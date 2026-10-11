import { eq } from "drizzle-orm";

import { authedRoute } from "@/server/auth";
import { config } from "@/server/config";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { usedTripQuota } from "@/server/trips/quota";
import { ensureUser } from "@/server/users";

/** The signed-in user's profile and what remains of the monthly quota. */
export const GET = authedRoute(async ({ userId }) => {
  await ensureUser(userId);
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const used = await usedTripQuota(userId);
  const { tripsPerMonth, adjustmentsPerTrip } = config.quotas;
  return Response.json({
    id: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale,
    quotas: {
      tripsPerMonth,
      tripsUsedThisMonth: used,
      tripsRemaining: Math.max(0, tripsPerMonth - used),
      adjustmentsPerTrip,
    },
  });
});
