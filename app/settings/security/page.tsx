import ChangePasswordForm from "@/components/ChangePasswordForm";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import { requirePageSession } from "@/lib/identity";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  await requirePageSession();

  return (
    <section aria-labelledby="security-settings-title" className="space-y-5">
      <div className="border-b border-border-subtle pb-5">
        <div className="flex items-center gap-2">
          <h2 id="security-settings-title" className="text-lg font-semibold tracking-[-0.015em]">Güvenlik</h2>
          <Badge tone="neutral">Yalnızca sen</Badge>
        </div>
        <p className="mt-1 text-[13px] leading-5 text-muted">
          Şifre değişikliği profil görünümünden ayrıdır ve yalnızca aktif hesabı etkiler.
        </p>
      </div>

      <div className="flex gap-3 rounded-xl border border-border-default bg-surface-subtle p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          <Icon name="shield" className="size-[18px]" />
        </span>
        <div>
          <p className="text-[13px] font-semibold text-foreground">Oturum koruması</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Şifren değiştiğinde açık oturumların kapatılır ve yeni şifreyle tekrar giriş yaparsın.
          </p>
        </div>
      </div>

      <ChangePasswordForm />
    </section>
  );
}
