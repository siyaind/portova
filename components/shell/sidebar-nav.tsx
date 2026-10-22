"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, NAV_ITEMS } from "@/lib/nav";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-6">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-lg border-l-2 px-2.5 py-2 text-sm transition ${
              active
                ? "border-violet bg-violet/15 text-ink shadow-[inset_0_0_24px_rgb(141_125_255/0.12)]"
                : "border-transparent text-muted hover:bg-white/5 hover:text-ink"
            }`}
          >
            <Icon size={16} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
