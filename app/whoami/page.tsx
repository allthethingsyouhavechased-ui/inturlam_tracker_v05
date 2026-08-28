import Link from "next/link";
import Logo from "@/components/Logo";
import ProductWordmark from "@/components/ProductWordmark";
import Icon from "@/components/ui/Icon";

export const dynamic = "force-dynamic";

export default function WhoAmIPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl flex-col justify-center py-10">
      <div className="mb-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-xl border border-border-default bg-white text-zinc-900 shadow-sm">
          <Logo className="size-9" />
        </span>
        <ProductWordmark className="mt-5 text-sm text-brand-600 dark:text-brand-300" />
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Giriş türünü seç</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-secondary">
          Ekip çalışma alanı ile marka guest portalı birbirinden ayrı ve güvenli oturumlar kullanır.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/whoami/team" className="group rounded-xl border border-border-default bg-surface p-6 shadow-sm transition hover:border-brand-300 hover:bg-surface-hover">
          <span className="grid size-11 place-items-center rounded-[10px] bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
            <Icon name="team" className="size-5" />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-foreground">Ekip girişi</h2>
          <p className="mt-1 text-sm leading-6 text-secondary">Panom, görevler, markalar, raporlar ve iç operasyon alanı.</p>
          <span className="mt-5 inline-flex text-sm font-semibold text-brand-600 group-hover:text-brand-700">Ekip hesabıyla giriş →</span>
        </Link>

        <Link href="/whoami/guest" className="group rounded-xl border border-border-default bg-surface p-6 shadow-sm transition hover:border-brand-300 hover:bg-surface-hover">
          <span className="grid size-11 place-items-center rounded-[10px] bg-surface-subtle text-secondary">
            <Icon name="brands" className="size-5" />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-foreground">Guest girişi</h2>
          <p className="mt-1 text-sm leading-6 text-secondary">Markanızın ilerlemesini, taleplerini ve paylaşılan etkinliklerini görün.</p>
          <span className="mt-5 inline-flex text-sm font-semibold text-brand-600 group-hover:text-brand-700">Guest hesabıyla giriş →</span>
        </Link>
      </div>
    </div>
  );
}
