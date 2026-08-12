"use client";

import Link from "next/link";
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
                  className={`sidebar-nav-item ui-press group relative flex min-h-10 items-center gap-3 rounded-[9px] px-2.5 text-[13px] font-medium transition-[color,background-color,border-color,padding,gap] ${
                    active
                      ? "bg-brand-50 text-brand-800 before:absolute before:-left-3 before:h-5 before:w-0.5 before:rounded-full before:bg-brand-600 dark:bg-brand-950/55 dark:text-brand-200 dark:before:bg-brand-400"
                      : "text-secondary hover:bg-surface-hover hover:text-foreground"
                  }`}
                >
                  <Icon
                    name={item.icon}
                    className={`size-[18px] transition-colors ${
                      active ? "text-brand-600 dark:text-brand-300" : "text-muted group-hover:text-secondary"
                    }`}
                  />
                  <span className="sidebar-copy min-w-0 flex-1 whitespace-nowrap transition-[width,opacity] duration-150">
                    {item.label}
                  </span>
                  {item.href === "/requests" && pendingRequestCount > 0 && (
                    <span className="sidebar-copy ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-brand-700 dark:bg-brand-950 dark:text-brand-200">
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
