import Link from "next/link";
import Logo from "@/components/Logo";
import SidebarNav from "@/components/SidebarNav";
import SidebarToggle from "@/components/SidebarToggle";
import Icon from "@/components/ui/Icon";
import { getCurrentPerson } from "@/lib/identity";
import { canReviewClientRequests } from "@/lib/requestAccess";
import { countOpenClientRequests } from "@/lib/repositories/clientRequests";

export default async function Sidebar() {
  const person = await getCurrentPerson();
  const pendingRequestCount = canReviewClientRequests(person) ? countOpenClientRequests() : 0;

  return (
    <aside className="app-sidebar flex h-full w-72 flex-col border-r border-border-subtle bg-surface md:w-full">
      <div className="flex h-[var(--header-h)] shrink-0 items-center border-b border-border-subtle px-4 md:px-3">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 rounded-[10px] px-1.5 py-1.5 text-foreground transition-colors hover:bg-surface-hover"
          aria-label="INTURLAM Tracker ana sayfa"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-border-default bg-white text-zinc-900 shadow-sm">
            <Logo className="size-6" />
          </span>
          <span className="sidebar-wordmark min-w-0 whitespace-nowrap transition-[width,opacity] duration-150">
            <span className="block text-[13px] font-semibold tracking-[-0.015em]">INTURLAM</span>
            <span className="block text-[9px] font-semibold tracking-[0.12em] text-muted">OPERATIONS</span>
          </span>
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <SidebarNav
          canViewReports={person?.is_manager === 1}
          pendingRequestCount={pendingRequestCount}
        />
      </div>

      <div className="sidebar-footer flex shrink-0 items-center gap-1 border-t border-border-subtle p-3">
        <Link
          href="/settings/profile"
          title="Ayarlar"
          className="sidebar-nav-item ui-press flex min-h-10 min-w-0 flex-1 items-center gap-3 rounded-[10px] px-2.5 text-[13px] font-medium text-secondary hover:bg-surface-hover hover:text-foreground"
        >
          <Icon name="settings" className="size-[18px] text-muted" />
          <span className="sidebar-copy whitespace-nowrap transition-[width,opacity] duration-150">Ayarlar</span>
        </Link>
        <SidebarToggle />
      </div>
    </aside>
  );
}
