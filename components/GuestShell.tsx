import Link from "next/link";
import Logo from "@/components/Logo";
import GuestNavigation from "@/components/GuestNavigation";
import GuestNotificationBell from "@/components/GuestNotificationBell";
import { clearIdentity } from "@/lib/actions/identity";
import { countUnreadForRecipient, listNotificationsForRecipient } from "@/lib/repositories/notifications";
import type { GuestActor } from "@/lib/types";

export default function GuestShell({ actor, children }: { actor: GuestActor; children: React.ReactNode }) {
  const notifications = listNotificationsForRecipient(actor.account_id);
  const unreadCount = countUnreadForRecipient(actor.account_id);
  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="sr-only z-[100] rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        İçeriğe geç
      </a>
      <header className="border-b border-border-subtle bg-surface">
        <div className="mx-auto flex h-[var(--header-h)] max-w-[var(--page-max)] items-center gap-3 px-4 sm:px-6">
          <Link href="/guest" className="flex items-center gap-2 text-sm font-semibold text-foreground"><span className="grid size-8 place-items-center rounded-lg border border-border-default bg-white text-zinc-900"><Logo className="size-5" /></span><span className="hidden sm:inline">İNTURLAM</span></Link>
          <GuestNavigation />
          <span className="ml-auto hidden text-xs text-muted sm:block">{actor.brand.name}</span>
          <GuestNotificationBell notifications={notifications} unreadCount={unreadCount} />
          <form action={clearIdentity}><button className="rounded-lg border border-border-default px-2 py-2 text-xs font-semibold text-secondary hover:bg-surface-hover sm:px-3">Çıkış</button></form>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[var(--page-max)] px-4 py-6 outline-none sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
