import ChangePasswordForm from "@/components/ChangePasswordForm";
import ChangeUsernameForm from "@/components/ChangeUsernameForm";
import PersonAvatar from "@/components/PersonAvatar";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import { departmentLabel } from "@/lib/departments";
import { requirePageSession } from "@/lib/identity";
import { getPerson } from "@/lib/repositories/people";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  const current = await requirePageSession();
  const { person: requestedId } = await searchParams;

  // `?person=` profil ekranındaki ile AYNI kuralda çözülüyor: yalnız kişinin
  // kendisi ya da bir yönetici başkasının kaydını açabilir, aksi halde sessizce
  // kendi kaydına düşer. Yöneticinin bu kapıya ihtiyacı var — arayüzden eklenen
  // (UUID id'li) hesapların kullanıcı adı boş başlıyor ve onu ancak bir yönetici
  // atayabiliyor. Yetki ayrıca Server Action'da yeniden doğrulanıyor.
  const requested = requestedId ? getPerson(requestedId) : null;
  const person = requested && (requested.id === current.id || current.is_manager === 1)
    ? requested
    : current;
  const isSelf = person.id === current.id;

  return (
    <section aria-labelledby="security-settings-title" className="space-y-5">
      <div className="border-b border-border-subtle pb-5">
        <div className="flex items-center gap-2">
          <h2 id="security-settings-title" className="text-lg font-semibold tracking-[-0.015em]">Güvenlik</h2>
          <Badge tone="neutral">{isSelf ? "Yalnızca sen" : "Yönetici düzenlemesi"}</Badge>
        </div>
        <p className="mt-1 text-[13px] leading-5 text-muted">
          Giriş kimliği ve şifre, profil görünümünden ayrı yönetilir.
        </p>
      </div>

      {!isSelf && (
        <div className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-subtle p-3">
          <PersonAvatar name={person.name} avatarPath={person.avatar_path} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{person.name}</p>
            <p className="truncate text-[11px] text-muted">{departmentLabel(person.department)}</p>
          </div>
        </div>
      )}

      <div className="flex gap-3 rounded-xl border border-border-default bg-surface-subtle p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          <Icon name="shield" className="size-[18px]" />
        </span>
        <div>
          <p className="text-[13px] font-semibold text-foreground">Oturum koruması</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Şifren değiştiğinde açık oturumların kapatılır ve yeni şifreyle tekrar giriş yaparsın.
            Kullanıcı adı değişikliği açık oturumları düşürmez.
          </p>
        </div>
      </div>

      <ChangeUsernameForm person={person} />

      {/* Şifre formu HER ZAMAN kendi hesabına ait: `changePassword` mevcut şifreyi
          soruyor, yani bir yöneticinin başkası adına kullanabileceği bir yol değil.
          Başkasının şifresini sıfırlamak hesap yönetimindeki ayrı akışta. */}
      {isSelf && <ChangePasswordForm />}
    </section>
  );
}
