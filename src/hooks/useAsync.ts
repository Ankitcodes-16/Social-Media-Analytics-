"use client";

import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

export type AsyncState<T> =
  | { status: "loading"; data?: T; error?: undefined }
  | { status: "success"; data: T; error?: undefined }
  | { status: "error"; error: Error; data?: T };

export type AsyncResult<T> = AsyncState<T> & { reload: () => void };

/**
 * Runs an async loader and tracks loading / success / error.
 *  - Stale responses are ignored (only the latest request may update state).
 *  - Previously loaded data is kept while a reload is in flight, so filters
 *    don't blank the page.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList): AsyncResult<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    setState((prev) => (prev.data !== undefined ? { status: "loading", data: prev.data } : { status: "loading" }));
    loader()
      .then((data) => {
        if (id === requestId.current) setState({ status: "success", data });
      })
      .catch((err: unknown) => {
        if (id === requestId.current) {
          setState({ status: "error", error: err instanceof Error ? err : new Error(String(err)) });
        }
      });
    return () => {
      requestId.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
