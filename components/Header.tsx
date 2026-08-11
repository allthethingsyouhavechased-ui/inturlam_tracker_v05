import Link from "next/link";
import AccountMenu from "@/components/AccountMenu";
import GlobalSearch from "@/components/GlobalSearch";
import MobileMenuButton from "@/components/MobileMenuButton";
import NotificationBell from "@/components/NotificationBell";
import QuickAddModal from "@/components/QuickAddModal";
import ThemeToggle from "@/components/ThemeToggle";
import { getCurrentPerson } from "@/lib/identity";
import { listBrands } from "@/lib/repositories/brands";
import { listAllContentSummaries } from "@/lib/repositories/content";
import { countUnreadForPerson, listNotificationsForPerson } from "@/lib/repositories/notifications";
import { listActivePeople } from "@/lib/repositories/people";

export default async function Header() {
  const person = await getCurrentPerson();
  const brands = person ? listBrands() : [];
  const contents = person ? listAllContentSummaries() : [];
  const people = person ? listActivePeople() : [];
  const notifications = person ? listNotificationsForPerson(person.id) : [];
  const unreadCount = person ? countUnreadForPerson(person.id) : 0;

  return (
    <header className="app-topbar sticky top-0 z-30 border-b border-border-subtle bg-background/90 backdrop-blur-xl">
      <div className="flex h-[var(--header-h)] items-center gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 items-center md:hidden">
          <MobileMenuButton />
        </div>

        <div className="flex min-w-0 flex-1 justify-start px-2 md:px-0">
          <GlobalSearch />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {person && (
            <QuickAddModal
              brands={brands}
              contents={contents}
              people={people}
              defaultAssigneeId={person.id}
              triggerLabel="Yeni görev"
              triggerClassName="header-quick-add ui-press inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-brand-600 px-3 text-[12px] font-semibold text-white shadow-sm hover:bg-brand-700"
            />
          )}
          {person && <NotificationBell notifications={notifications} unreadCount={unreadCount} />}
          <ThemeToggle />
          {person ? (
            <AccountMenu person={person} />
          ) : (
            <Link href="/whoami" className="ui-press inline-flex min-h-10 items-center rounded-[10px] border border-border-default bg-surface px-3 text-[12px] font-semibold text-foreground hover:bg-surface-hover">
              Kimlik seç
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
