import Link from "next/link";
import { notFound } from "next/navigation";
import DeactivatePersonButton from "@/components/DeactivatePersonButton";
import ManagerRoleButton from "@/components/ManagerRoleButton";
import NewPersonPopover from "@/components/NewPersonPopover";
import PersonAvatar from "@/components/PersonAvatar";
import ResetPersonPasswordPopover from "@/components/ResetPersonPasswordPopover";
import { buttonClass } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import { canManageRoles, ROLE_ADMIN_PERSON_ID } from "@/lib/auth/authorization";
import { requirePageSession } from "@/lib/identity";
import { listGuestAccounts } from "@/lib/repositories/accounts";
import { listInactivePeople, listLoginPeople } from "@/lib/repositories/people";

export const dynamic = "force-dynamic";

export default async function TeamManagementPage() {
  const currentPerson = await requirePageSession();
  if (currentPerson.is_manager !== 1) notFound();

  const people = listLoginPeople();
  const inactive = listInactivePeople();
  const canEditRoles = canManageRoles(currentPerson);
  // Yalnız sayaç için: liste ve form artık /team/manage/guest sayfasında.
  const guestAccounts = listGuestAccounts();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        eyebrow="YÖNETİM"
        title="Hesap yönetimi"
        description="Ekip hesaplarını aç, erişim rollerini yönet veya ayrılan çalışanları pasife al."
        breadcrumb={[{ label: "Ekip", href: "/team" }, { label: "Hesap yönetimi" }]}
        actions={
          <>
            {/* Guest hesapları artık ayrı bir sayfa: bu listenin en altında
                dururken varlığı fark edilmiyordu (bkz. app/team/manage/guest). */}
            <Link
              href="/team/manage/guest"
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              <Icon name="user" className="size-3.5" />
              Guest hesapları
              <span className="tabular-nums text-muted">{guestAccounts.length}</span>
            </Link>
            <NewPersonPopover />
          </>
        }
      />

      <section aria-labelledby="active-accounts-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="active-accounts-title" className="text-sm font-semibold text-foreground">
            Aktif hesaplar <span className="font-normal text-muted">· {people.length}</span>
          </h2>
          {!canEditRoles && <p className="text-xs text-muted">Rol değişiklikleri sistem yöneticisine aittir.</p>}
        </div>
        <div className="overflow-hidden rounded-xl border border-border-default bg-surface">
          {people.map((person, index) => (
            <div
              key={person.id}
              className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center ${index > 0 ? "border-t border-border-subtle" : ""}`}
            >
              <Link href={`/team/${person.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
                <PersonAvatar name={person.name} avatarPath={person.avatar_path} size="md" />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-300">
                      {person.name}
                    </span>
                    {person.is_manager === 1 && (
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                        YÖNETİCİ
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {person.username ? (
                      <span className="font-medium text-secondary">@{person.username}</span>
                    ) : (
                      <span className="font-medium text-warning">
                        kullanıcı adı belirlenmedi
                      </span>
                    )}
                    {" · "}
                    {[person.title, person.department].filter(Boolean).join(" · ") || "Profil bilgisi bekleniyor"}
                  </span>
                </span>
              </Link>
              {/* Her aksiyon SABİT genişlikte kendi sütununda; koşullu olanlar
                  yoksa hücre boş kalıyor. Serbest akışta ("Yönetici yap" ile
                  "Yöneticiliği kaldır" farklı genişlikte, şifre düğmesi kimi
                  satırda hiç yok) her satır bir öncekinden kaymış görünüyordu. */}
              <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[9rem_8.5rem_9.5rem_10rem_4.5rem] sm:justify-items-start">
                <Link
                  href={`/settings/profile?person=${person.id}`}
                  className="ui-press inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-[9px] px-2.5 text-xs font-semibold text-secondary hover:bg-surface-hover hover:text-foreground"
                >
                  <Icon name="user" className="size-3.5" />
                  Profili düzenle
                </Link>
                {/* Kullanıcı adı Güvenlik sekmesinde. Bağlantı buradan da veriliyor:
                    arayüzden eklenen (UUID id'li) hesapların kullanıcı adı boş
                    başlıyor ve onu yalnızca bir yönetici atayabiliyor. */}
                <Link
                  href={`/settings/security?person=${person.id}`}
                  className="ui-press inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-[9px] px-2.5 text-xs font-semibold text-secondary hover:bg-surface-hover hover:text-foreground"
                >
                  <Icon name="shield" className="size-3.5" />
                  Kullanıcı adı
                </Link>
                {canEditRoles && person.id !== ROLE_ADMIN_PERSON_ID ? (
                  <ManagerRoleButton personId={person.id} isManager={person.is_manager === 1} />
                ) : <span aria-hidden="true" />}
                {(person.is_manager !== 1 || canEditRoles) ? (
                  <ResetPersonPasswordPopover
                    personId={person.id}
                    personName={person.name}
                    needsPassword={person.has_password !== 1}
                  />
                ) : <span aria-hidden="true" />}
                {person.id !== ROLE_ADMIN_PERSON_ID ? (
                  <DeactivatePersonButton personId={person.id} />
                ) : <span aria-hidden="true" />}
              </div>
            </div>
          ))}
        </div>
      </section>

      {inactive.length > 0 && (
        <section className="mt-8" aria-labelledby="inactive-accounts-title">
          <h2 id="inactive-accounts-title" className="mb-3 text-sm font-semibold text-foreground">
            Pasif hesaplar <span className="font-normal text-muted">· {inactive.length}</span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-dashed border-border-default bg-surface-subtle">
            {inactive.map((person, index) => (
              <div
                key={person.id}
                className={`flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 ${index > 0 ? "border-t border-border-subtle" : ""}`}
              >
                <span className="min-w-0 truncate text-sm text-secondary">
                  {person.name}
                  {person.username && <span className="ml-2 text-xs text-muted">@{person.username}</span>}
                </span>
                <DeactivatePersonButton personId={person.id} active={false} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
