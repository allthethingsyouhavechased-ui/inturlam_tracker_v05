"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sosyal menüsünün üç kardeş sayfası arasındaki sekme şeridi. Menüdeki
// "Sosyal" öğesinin altındaki children ile BİREBİR aynı üç href (lib/nav.ts) —
// ikisi ayrı yerlerde ama aynı üç rotayı gösteriyor, biri değişirse diğeri de
// güncellenmeli.
const TABS = [
  { href: "/social/takip", label: "Takip" },
  { href: "/social/varlik", label: "Varlık" },
  { href: "/social/takvim", label: "Paylaşım Takvimi" },
] as const;

export default function SocialTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sosyal alt sayfaları"
      className="flex flex-wrap gap-1 border-b border-black/10 pb-2 dark:border-white/10"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`ui-press inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-600 text-white shadow-sm"
                : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
