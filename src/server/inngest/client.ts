import { Inngest } from "inngest";

/**
 * Inngest client. `INNGEST_DEV=1` in `.env` puts it in development mode: events
 * go to the local Dev Server (http://localhost:8288) and no event or signing key
 * is needed. The production keys come with the EAS Hosting deployment.
 */
export const inngest = new Inngest({ id: "tripagent" });
