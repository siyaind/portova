"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Brand } from "@/components/brand";
import { useChain } from "@/components/chain/chain-provider";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { TopBar } from "@/components/shell/top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => navRef.current?.querySelector<HTMLElement>("a, button")?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
      if (event.key !== "Tab") return;
      const elements = navRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.cancelAnimationFrame(frame); document.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [navOpen]);

  if (pathname === "/") {
    return <><a href="#main" className="skip-link">Skip to content</a>{children}</>;
  }

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
        <aside className="app-sidebar sticky top-0 hidden h-screen w-60 shrink-0 flex-col lg:flex">
          <div className="app-brand-wrap"><Brand compact /><span className="app-brand-tag">WORKSPACE</span></div>
          <SidebarNav />
          <SidebarFooter />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onOpenNav={() => setNavOpen(true)} />
          <main id="main" className="app-main mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-7 sm:px-7 lg:px-9 lg:py-9">
            {children}
          </main>
          <div className="app-bottom-bar"><span>Made for what comes next.</span><span>Portova <span className="text-violet">/</span> Portaldot V3 Testnet</span></div>
        </div>
      </div>
      {navOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <aside ref={navRef} className="app-sidebar mobile-sidebar relative z-10 flex h-full w-[min(100%,18rem)] shrink-0 flex-col" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="flex items-center justify-between pr-3">
              <div className="app-brand-wrap"><Brand compact /></div>
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
            <SidebarFooter />
          </aside>
          <button
            type="button"
            aria-label="Close navigation"
            className="min-h-full min-w-0 flex-1 bg-black/70"
            onClick={() => setNavOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

function SidebarFooter() {
  const chain = useChain();
  return <div className="sidebar-footer"><div><span className={`live-dot ${chain.status === "live" ? "is-live" : ""}`} /><strong>Portaldot V3</strong><span className="sidebar-testnet">TESTNET</span></div><p>{chain.status === "live" ? `Connected · Block ${chain.blockNumber ?? "—"}` : chain.status === "connecting" ? "Connecting to the network…" : "Network unavailable"}</p><span>Your keys. Your creative freedom.</span></div>;
}

