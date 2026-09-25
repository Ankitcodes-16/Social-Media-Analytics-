"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Database, Gauge, LayoutDashboard, Network, TrendingUp, X } from "lucide-react";
import { getDataMode } from "@/services";
import { Logo } from "./Logo";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  badge?: "alerts";
}

const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/trends", label: "Trends", icon: TrendingUp },
  { href: "/sentiment", label: "Sentiment", icon: Gauge },
  { href: "/network", label: "Network", icon: Network },
  { href: "/alerts", label: "Alerts", icon: Bell, badge: "alerts" },
  { href: "/explorer", label: "Data Explorer", icon: Database },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({ alertCount, onNavigate }: { alertCount?: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  const mode = getDataMode();
  const feed = mode === "simulated" ? "Simulated feed" : mode === "live" ? "Backend feed" : "Partly simulated";

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-5">
        <Logo />
        <div className="leading-tight">
          <div className="text-[14px] font-semibold tracking-tight text-fg">Trend Sphere</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-fg-dim">Social intelligence</div>
        </div>
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors ${
                active ? "bg-ink-700 text-fg" : "text-fg-muted hover:bg-ink-800 hover:text-fg"
              }`}
            >
              <Icon size={16} className={active ? "text-signal" : "text-fg-dim group-hover:text-fg-muted"} />
              <span className="flex-1">{item.label}</span>
              {item.badge === "alerts" && alertCount !== undefined && alertCount > 0 ? (
                <span
                  className="rounded-full bg-rose-500/20 px-1.5 text-[11px] font-semibold tabular-nums text-rose-300"
                  title={`${alertCount} active alert${alertCount === 1 ? "" : "s"}`}
                >
                  {alertCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-line px-5 py-4">
        <div className="eyebrow">Sources</div>
        {(["X", "Telegram"] as const).map((name) => (
          <div key={name} className="flex items-center gap-2 text-xs text-fg-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${mode === "live" ? "bg-emerald-400" : "bg-amber-400"}`} />
            <span className="text-fg">{name}</span>
            <span className="text-fg-dim">· {feed}</span>
          </div>
        ))}
        <div className="pt-1 text-[11px] text-fg-dim">Phase 1 · frontend build</div>
      </div>
    </div>
  );
}

export function Sidebar({
  open,
  onClose,
  alertCount,
}: {
  open: boolean;
  onClose: () => void;
  alertCount?: number;
}) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-ink-900 lg:block">
        <SidebarContent alertCount={alertCount} />
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />
          <aside className="absolute inset-y-0 left-0 w-64 animate-slide-in border-r border-line bg-ink-900">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={onClose}
              className="absolute right-3 top-3.5 rounded p-1 text-fg-dim hover:text-fg"
            >
              <X size={16} />
            </button>
            <SidebarContent alertCount={alertCount} onNavigate={onClose} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
