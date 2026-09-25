import type { ReactNode } from "react";
import type { AsyncResult } from "@/hooks/useAsync";
import { EmptyState, ErrorState, LoadingState } from "./States";

interface AsyncBoundaryProps<T> {
  state: AsyncResult<T>;
  children: (data: T) => ReactNode;
  /** Shown before the first load completes. */
  loading?: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  errorTitle?: string;
}

/**
 * Renders loading / error / empty / content for an async section.
 * While a reload is in flight the previous content stays visible (dimmed).
 */
export function AsyncBoundary<T>({ state, children, loading, isEmpty, empty, errorTitle }: AsyncBoundaryProps<T>) {
  if (state.status === "error") {
    return <ErrorState error={state.error} onRetry={state.reload} title={errorTitle} />;
  }
  if (state.data === undefined) {
    return <>{loading ?? <LoadingState />}</>;
  }
  if (isEmpty && isEmpty(state.data)) {
    return <>{empty ?? <EmptyState title="Nothing to show yet" />}</>;
  }
  return (
    <div className={`transition-opacity duration-150 ${state.status === "loading" ? "opacity-60" : "opacity-100"}`}>
      {children(state.data)}
    </div>
  );
}
