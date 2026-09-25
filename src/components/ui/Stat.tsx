import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export interface StatDelta {
  value: string;
  direction: "up" | "down" | "flat";
  tone: "positive" | "negative" | "neutral";
}

const TONE: Record<StatDelta["tone"], string> = {
  positive: "text-emerald-300",
  negative: "text-rose-300",
  neutral: "text-fg-muted",
};

export function DeltaText({ delta }: { delta: StatDelta }) {
  const Icon = delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${TONE[delta.tone]}`}>
      <Icon size={12} />
      {delta.value}
    </span>
  );
}

export function StatTile({
  label,
  value,
  sub,
  delta,
  icon,
  href,
  highlight = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: StatDelta;
  icon?: ReactNode;
  href?: string;
  highlight?: boolean;
}) {
  const body = (
    <div
      className={`h-full rounded-lg border p-4 transition-colors ${
        highlight ? "border-signal/30 bg-signal/[0.04]" : "border-line bg-ink-900"
      } ${href ? "hover:border-line-strong" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {icon ? <span className="text-fg-dim">{icon}</span> : null}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums tracking-tight text-fg">{value}</span>
        {delta ? <DeltaText delta={delta} /> : null}
      </div>
      {sub ? <div className="mt-1 text-xs text-fg-dim">{sub}</div> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
