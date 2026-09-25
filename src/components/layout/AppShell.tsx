"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ALERTS_CHANGED_EVENT, getAlerts } from "@/services";
import { useAsync } from "@/hooks/useAsync";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const active = useAsync(() => getAlerts({ status: "active" }), []);
  const reloadAlerts = active.reload;

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Keep the sidebar badge in sync when an alert's status changes anywhere.
  useEffect(() => {
    const handler = (): void => reloadAlerts();
    window.addEventListener(ALERTS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(ALERTS_CHANGED_EVENT, handler);
  }, [reloadAlerts]);

  const alertCount = active.data?.length;

  return (
    <div className="min-h-screen">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} alertCount={alertCount} />
      <div className="lg:pl-60">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
