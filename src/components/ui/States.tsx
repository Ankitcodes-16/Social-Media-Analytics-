import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-shimmer rounded bg-ink-700/70 ${className}`} />;
}

/** Card-shaped placeholder shown while a section loads. */
export function LoadingState({ label = "Loading", className = "h-64" }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col justify-between rounded-lg border border-line bg-ink-900 p-4 ${className}`}
    >
      <div className="space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-2.5 w-1/4" />
      </div>
      <div className="flex items-end gap-1.5">
        {[38, 52, 44, 66, 58, 80, 72, 92, 70, 86, 62, 76].map((h, i) => (
          <div key={i} className="animate-shimmer flex-1 rounded-sm bg-ink-700/60" style={{ height: `${h * 0.45}px` }} />
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-fg-dim">
        <Loader2 size={12} className="animate-spin" />
        {label}…
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = "Couldn't load this section",
  className = "",
}: {
  error?: Error;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <div role="alert" className={`rounded-lg border border-rose-400/25 bg-rose-400/5 p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg">{title}</p>
          {error?.message ? <p className="mt-1 break-words text-xs text-fg-muted">{error.message}</p> : null}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 rounded border border-line-strong bg-ink-800 px-2.5 py-1.5 text-xs font-medium text-fg hover:bg-ink-700"
            >
              <RefreshCw size={12} />
              Try again
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong px-6 py-12 text-center ${className}`}>
      <div className="mb-3 text-fg-dim">{icon ?? <Inbox size={22} />}</div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-xs text-fg-dim">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
