import { QueryClient } from "@tanstack/react-query";

/** One TanStack Query client for the app (provided by the root layout). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000 },
  },
});
