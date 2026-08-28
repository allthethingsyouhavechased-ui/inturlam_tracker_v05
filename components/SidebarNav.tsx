"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { isNavActive, visibleNavGroups } from "@/lib/nav";

export default function SidebarNav({
  canViewReports,
  canViewRequests,
  pendingRequestCount = 0,
}: {
  canViewReports: boolean;
  canViewRequests: boolean;
  pendingRequestCount?: number;
}) {
  const pathname = usePathname();
  const groups = visibleNavGroups(canViewReports, canViewRequests);

  return (
    <nav aria-label="Ana gezinme" className="flex min-h-0 flex-1 flex-col gap-4 py-3">
      {groups.map((group) => (
        <div key={group.id} className="sidebar-nav-group px-3 transition-[padding] duration-200">
          <p className="sidebar-group-label mb-1 whitespace-nowrap px-2 text-[9px] font-bold tracking-[0.11em] text-faint transition-[width,opacity] duration-150">
            {group.label.toLocaleUpperCase("tr-TR")}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  className={`sidebar-nav-item ui-press group relative flex min-h-10 items-center gap-3 rounded-[9px] px-2.5 text-[13px] font-medium transition-[color,padding,gap] ${
                    active
                      ? "text-brand-800 dark:text-brand-200"
                      : "text-secondary hover:bg-surface-hover hover:text-foreground"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active-pill"
                      transition={{ type: "spring", stiffness: 480, damping: 34, mass: 0.9 }}
                      className="absolute inset-0 rounded-[9px] bg-brand-50 dark:bg-brand-950/55"
                    >
                      <span className="absolute -left-3 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-600 dark:bg-brand-400" />
                    </motion.span>
                  )}
                  <Icon
                    name={item.icon}
                    className={`relative z-10 size-[18px] transition-colors ${
                      active ? "text-brand-600 dark:text-brand-300" : "text-muted group-hover:text-secondary"
                    }`}
                  />
                  <span className="sidebar-copy relative z-10 min-w-0 flex-1 whitespace-nowrap transition-[width,opacity] duration-150">
                    {item.label}
                  </span>
                  {item.href === "/requests" && pendingRequestCount > 0 && (
                    <span className="sidebar-copy relative z-10 ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-brand-700 dark:bg-brand-950 dark:text-brand-200">
                      {pendingRequestCount > 99 ? "99+" : pendingRequestCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
