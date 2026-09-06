import Link from "next/link";
import AccountMenu from "@/components/AccountMenu";
import GlobalSearch from "@/components/GlobalSearch";
import MobileMenuButton from "@/components/MobileMenuButton";
import NotificationBell from "@/components/NotificationBell";
import QuickAddModal from "@/components/QuickAddModal";
import ThemeToggle from "@/components/ThemeToggle";
import { getCurrentPerson } from "@/lib/identity";
import { todayISO } from "@/lib/date";
import { formatPoints } from "@/lib/progress";
import { countUnreadForPerson, listNotificationsForPerson } from "@/lib/repositories/notifications";
import { getPersonPointTargetProgress } from "@/lib/repositories/monthlyPointTargets";

// Header LAYOUT'ta duruyor, yani uygulamanın HER isteğinde çalışıyor. Bu yüzden
// burada yalnızca gerçekten her ekranda gösterilen veri okunur. Hızlı görev
// penceresinin marka/içerik/kişi listeleri buradan KALDIRILDI (2026-08-27):
// pencere kapalıyken bile üç tam tablo okunup istemciye serileştiriliyordu.
// Artık `QuickAddModal` ilk açılışta `loadQuickAddOptionsAction` ile kendi çekiyor.
export default async function Header() {
  const person = await getCurrentPerson();
  const notifications = person ? listNotificationsForPerson(person.id) : [];
  const unreadCount = person ? countUnreadForPerson(person.id) : 0;
  const month = todayISO().slice(0, 7);
  const monthlyProgress = person ? getPersonPointTargetProgress(person.id, month) : null;

  return (
    <header className="app-topbar sticky top-0 z-30 border-b border-border-subtle bg-background/90 backdrop-blur-xl">
      <div className="relative flex h-[var(--header-h)] items-center gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 items-center md:hidden">
          <MobileMenuButton />
        </div>

        <div className="flex min-w-0 flex-1 justify-start px-2 md:px-0">
          <GlobalSearch />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {person && monthlyProgress && (
            <Link
              href={`/panom/katkim?month=${month}`}
              title={`Aylık hedefim: ${formatPoints(monthlyProgress.earned_points)} / ${monthlyProgress.target_points ?? "—"} puan`}
              className="ui-press hidden min-h-9 items-center gap-1 rounded-md border border-border-default bg-surface px-2.5 text-[11px] font-semibold text-secondary hover:bg-surface-hover hover:text-foreground lg:inline-flex"
            >
              <span className="text-muted">Bu ay</span>
              <span className="tabular-nums text-foreground">{monthlyProgress.percent === null ? "Hedef yok" : `${formatPoints(monthlyProgress.earned_points)}/${monthlyProgress.target_points} · %${monthlyProgress.percent}`}</span>
            </Link>
          )}
          {person && (
            <QuickAddModal
              listenForShortcut
              defaultAssigneeId={person.id}
              canSetWeight={person.is_manager === 1}
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
