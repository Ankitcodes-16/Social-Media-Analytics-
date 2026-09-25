import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-line bg-ink-900 ${className}`}>{children}</section>;
}

interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-3 px-4 pt-3.5">
      <div className="min-w-0">
        <h2 className="text-[13px] font-medium text-fg">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-fg-dim">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-4 pb-4 pt-3 ${className}`}>{children}</div>;
}
