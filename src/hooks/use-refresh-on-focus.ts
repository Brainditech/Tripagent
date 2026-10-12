import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

/**
 * Reads a query again each time its screen comes back into view. The tab screens stay mounted,
 * so `useQuery` alone would show what was loaded the first time; the first focus is skipped,
 * since `useQuery` is fetching then.
 */
export function useRefreshOnFocus(refetch: () => Promise<unknown>) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );
}
