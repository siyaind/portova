"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { TopBar } from "@/components/shell/top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <div className="shell min-h-screen text-ink">
      <div className="atmosphere" aria-hidden>
        <span />
        <span />
      </div>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-panel focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/8 bg-[#0c0d11]/75 backdrop-blur-xl lg:flex">
          <Brand />
          <SidebarNav />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onOpenNav={() => setNavOpen(true)} />
          <main id="main" className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-6">
            {children}
          </main>
        </div>
      </div>
      {navOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/70"
            onClick={() => setNavOpen(false)}
          />
          <aside className="relative flex h-full w-[min(100%,18rem)] flex-col border-r border-white/8 bg-[#0c0d11]/90 backdrop-blur-xl">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button
                type="button"
                aria-label="Close navigation"
                className="rounded-md p-2 text-muted hover:bg-panel-2 hover:text-ink"
                onClick={() => setNavOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <SidebarNav />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function Brand() {
  return (
    <div className="flex h-14 items-center gap-2.5 px-4">
      <span className="grid h-7 w-7 place-items-center rounded-md bg-violet text-sm font-semibold text-violet-ink">
        P
      </span>
      <span className="text-sm font-semibold tracking-[0.16em]">PORTOVA</span>
    </div>
  );
}

