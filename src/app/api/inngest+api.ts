import { serve } from "inngest/edge";

import { inngest } from "@/server/inngest/client";
import { functions } from "@/server/inngest/functions";

/**
 * Inngest endpoint. The `edge` handler only needs the standard Request and
 * Response, which is what Expo API routes provide (Node in development,
 * workerd on EAS Hosting). GET shows the SDK status, PUT registers the
 * functions with Inngest, POST runs a step.
 */
const handler = serve({ client: inngest, functions });

export const GET = handler;
export const POST = handler;
export const PUT = handler;
