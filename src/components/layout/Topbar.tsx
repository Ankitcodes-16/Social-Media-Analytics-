"use client";

import { Clock, Menu } from "lucide-react";
import { Logo } from "./Logo";
import { DataModeBadge } from "./DataModeBadge";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-ink-950/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenu}
          className="rounded p-1.5 text-fg-muted hover:bg-ink-800 hover:text-fg lg:hidden"
        >
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-2 lg:hidden">
          <Logo size={18} />
          <span className="text-sm font-semibold tracking-tight">Trend Sphere</span>
        </div>
        <div className="hidden items-center gap-1.5 text-xs text-fg-dim lg:flex">
          <Clock size={12} />
          Last 24 hours · hourly buckets · all times UTC
        </div>
      </div>
      <DataModeBadge />
    </header>
  );
}
