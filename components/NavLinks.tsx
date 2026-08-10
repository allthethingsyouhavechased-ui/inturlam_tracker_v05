"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isNavActive, visibleNav, type NavItem } from "@/lib/nav";

const linkClass = (active: boolean) =>
  `border-b-2 px-2.5 py-1.5 text-sm transition-colors ${
    active
      ? "border-brand-600 font-medium text-zinc-900 dark:border-brand-400 dark:text-white"
      : "border-transparent text-zinc-600 hover:border-black/20 hover:text-zinc-900 dark:text-zinc-300 dark:hover:border-white/30 dark:hover:text-white"
  }`;

// "Sosyal" gibi çocuklu bir menü öğesi — NotificationBell'deki dropdown deseni:
// `relative` sarmalayıcı + `absolute` panel, dışarı tıklama/Escape ile kapanır.
// Header'ın `backdrop-blur`ı yalnızca `position: fixed` torunları için
// containing-block tuzağı yaratıyor (bkz. NotificationBell yorumu) — bu panel
// `absolute` olduğu için portal/`useIsClient` gerekmez.
function NavDropdown({ item, active }: { item: NavItem; active: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 ${linkClass(active)}`}
      >
        {item.label}
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`size-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.22 7.47a.75.75 0 0 1 1.06 0L10 11.19l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.53a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-2 w-52 rounded-xl border border-black/10 bg-white p-1.5 shadow-lg dark:border-white/10 dark:bg-zinc-900">
          {(item.children ?? []).map((child) => {
            const childActive = isNavActive(pathname, child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={() => setOpen(false)}
                aria-current={childActive ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 text-sm ${
                  childActive
                    ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                    : "text-zinc-700 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
                }`}
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

// Masaüstü bölüm menüsü. Linkler dar ekranda header'ı taşırıp sayfaya yatay
// kaydırma ekliyordu; `md`nin altında gizleniyor ve aynı linkler mobilde
// off-canvas panelin üstünde çıkıyor (components/SidebarNavLinks.tsx).
export default function NavLinks({ canViewReports }: { canViewReports: boolean }) {
  const pathname = usePathname();
  const links = visibleNav(canViewReports);

  return (
    <span className="hidden items-center gap-1 md:flex">
      {links.map((link) => {
        const active = isNavActive(pathname, link.href);
        if (link.children) {
          return <NavDropdown key={link.href} item={link} active={active} />;
        }
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
    </span>
  );
}
