"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/guest", label: "Dashboard", exact: true },
  { href: "/guest/tasks", label: "Görevler", exact: false },
  { href: "/guest/calendar", label: "Takvim", exact: false },
] as const;

export default function GuestNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Guest menüsü" className="flex items-center gap-0.5 text-xs sm:ml-3 sm:gap-1 sm:text-sm">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-2 py-2 sm:px-3 ${active ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-950/30 dark:text-brand-300" : "text-secondary hover:bg-surface-hover"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
