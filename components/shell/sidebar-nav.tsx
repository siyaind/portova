"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, NAV_ITEMS } from "@/lib/nav";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="sidebar-navigation flex flex-1 flex-col overflow-y-auto">
      {[
        { label: "Discover", hrefs: ["/overview", "/explore"] },
        { label: "Create & trade", hrefs: ["/launch", "/token-launchpad", "/nft-launchpad", "/swap", "/liquidity", "/market"] },
        { label: "Your workspace", hrefs: ["/studio", "/portfolio", "/treasury"] },
        { label: "Resources", hrefs: ["/run", "/activity", "/settings"] },
      ].map((group) => <div key={group.label} className="nav-group"><p>{group.label}</p>{group.hrefs.map((href) => NAV_ITEMS.find((item) => item.href === href)!).map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
          >
            <Icon size={17} strokeWidth={1.7} aria-hidden />
            {item.label}
            {active ? <span className="nav-active-dot" /> : null}
          </Link>
        );
      })}</div>)}
    </nav>
  );
}
