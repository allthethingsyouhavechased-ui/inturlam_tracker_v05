"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/social/takip", label: "Takip" },
  { href: "/social/varlik", label: "Varlık" },
  { href: "/social/takvim", label: "Paylaşım takvimi" },
  { href: "/social/rapor", label: "Stok raporu" },
] as const;

export default function SocialTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sosyal çalışma alanı"
      className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[10px] border border-border-default bg-surface-subtle p-1"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`ui-press inline-flex min-h-9 shrink-0 items-center rounded-lg px-3 text-xs font-semibold transition-colors ${
              active
                ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                : "text-muted hover:bg-surface-hover hover:text-secondary"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
