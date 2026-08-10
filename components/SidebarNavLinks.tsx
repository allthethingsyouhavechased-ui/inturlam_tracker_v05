"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { isNavActive, visibleNav, type NavItem } from "@/lib/nav";

const linkClass = (active: boolean) =>
  `flex min-h-11 items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
    active
      ? "bg-brand-600 text-white shadow-sm"
      : "text-zinc-700 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5"
  }`;

// Çocuklu öğe (Sosyal) — SidebarClusterGroup ile aynı akordeon deseni: alt
// sayfalarından biri aktifse render sırasında (useEffect DEĞİL, React 19
// `set-state-in-effect` kuralı) kendiliğinden açılır.
function NavAccordion({ item, pathname }: { item: NavItem; pathname: string }) {
  const children = item.children ?? [];
  const isActive = children.some((child) => isNavActive(pathname, child.href));

  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const [prevActive, setPrevActive] = useState(isActive);
  if (isActive !== prevActive) {
    setPrevActive(isActive);
    if (isActive) setManualOpen(null);
  }
  const open = manualOpen ?? isActive;

  return (
    <div>
      <button
        type="button"
        onClick={() => setManualOpen(!open)}
        aria-expanded={open}
        className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
            : "text-zinc-700 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5"
        }`}
      >
        {item.label}
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`size-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.22 7.47a.75.75 0 0 1 1.06 0L10 11.19l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.53a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <div className="ml-3 mt-1 space-y-0.5 border-l border-black/10 py-1 pl-2 dark:border-white/10">
          {children.map((child) => {
            const active = isNavActive(pathname, child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                aria-current={active ? "page" : undefined}
                className={linkClass(active)}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Mobil off-canvas panelin üstündeki bölüm linkleri. Header'daki NavLinks
// `md`nin altında gizlendiği için linklere telefondan buradan geçiliyor.
// Panel rota değişiminde kendiliğinden kapanır (SidebarMobileFrame).
export default function SidebarNavLinks({ canViewReports }: { canViewReports: boolean }) {
  const pathname = usePathname();
  const links = visibleNav(canViewReports);

  return (
    <div className="mb-4 space-y-1 border-b border-black/5 pb-4 md:hidden dark:border-white/5">
      {links.map((link) => {
        if (link.children) {
          return <NavAccordion key={link.href} item={link} pathname={pathname} />;
        }
        const active = isNavActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={linkClass(active)}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
