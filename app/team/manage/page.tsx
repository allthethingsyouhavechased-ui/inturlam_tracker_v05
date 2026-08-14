import Link from "next/link";
import { notFound } from "next/navigation";
import ActionForm from "@/components/ActionForm";
import DeactivatePersonButton from "@/components/DeactivatePersonButton";
import ManagerRoleButton from "@/components/ManagerRoleButton";
import NewPersonPopover from "@/components/NewPersonPopover";
import PersonAvatar from "@/components/PersonAvatar";
import ResetPersonPasswordPopover from "@/components/ResetPersonPasswordPopover";
import SubmitButton from "@/components/SubmitButton";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import { canManageRoles, ROLE_ADMIN_PERSON_ID } from "@/lib/auth/authorization";
import { requirePageSession } from "@/lib/identity";
import {
  saveGuestAccountAction,
  setGuestAccountActiveAction,
} from "@/lib/actions/people";
import { listBrands } from "@/lib/repositories/brands";
import { listGuestAccounts } from "@/lib/repositories/accounts";
import { listInactivePeople, listLoginPeople } from "@/lib/repositories/people";

export const dynamic = "force-dynamic";

export default async function TeamManagementPage() {
  const currentPerson = await requirePageSession();
  if (currentPerson.is_manager !== 1) notFound();

  const people = listLoginPeople();
  const inactive = listInactivePeople();
  const canEditRoles = canManageRoles(currentPerson);
  const brands = listBrands();
  const guestAccounts = listGuestAccounts();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        eyebrow="YÖNETİM"
        title="Hesap yönetimi"
        description="Ekip hesaplarını aç, erişim rollerini yönet veya ayrılan çalışanları pasife al."
        breadcrumb={[{ label: "Ekip", href: "/team" }, { label: "Hesap yönetimi" }]}
        actions={<NewPersonPopover />}
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
                      <span className="font-medium text-amber-700 dark:text-amber-300">
                        kullanıcı adı belirlenmedi
                      </span>
                    )}
                    {" · "}
                    {[person.title, person.department].filter(Boolean).join(" · ") || "Profil bilgisi bekleniyor"}
                  </span>
                </span>
              </Link>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Link
                  href={`/settings/profile?person=${person.id}`}
                  className="ui-press inline-flex min-h-9 items-center gap-1.5 rounded-[9px] px-2.5 text-xs font-semibold text-secondary hover:bg-surface-hover hover:text-foreground"
                >
                  <Icon name="user" className="size-3.5" />
                  Profili düzenle
                </Link>
                {canEditRoles && person.id !== ROLE_ADMIN_PERSON_ID && (
                  <ManagerRoleButton personId={person.id} isManager={person.is_manager === 1} />
                )}
                {(person.is_manager !== 1 || canEditRoles) && (
                  <ResetPersonPasswordPopover
                    personId={person.id}
                    personName={person.name}
                    needsPassword={person.has_password !== 1}
                  />
                )}
                {person.id !== ROLE_ADMIN_PERSON_ID && (
                  <DeactivatePersonButton personId={person.id} />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="guest-accounts-title">
        <h2 id="guest-accounts-title" className="mb-1 text-sm font-semibold text-foreground">Guest hesapları</h2>
        <p className="mb-3 text-xs text-muted">Her marka için en fazla bir ortak guest hesabı bulunur. Aynı marka yeniden kaydedilirse kullanıcı adı ve şifresi yenilenir.</p>
        <ActionForm action={saveGuestAccountAction} successMessage="Guest hesabı kaydedildi." resetOnSuccess feedbackClassName="sm:col-span-2 lg:col-span-5" className="grid gap-3 rounded-xl border border-border-default bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="grid gap-1 text-xs font-medium text-secondary">Marka<select name="brandId" required className="min-h-10 rounded-lg border border-border-default bg-background px-2 text-sm"><option value="">Seç</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-medium text-secondary">Kullanıcı adı<input name="username" required minLength={3} maxLength={40} className="min-h-10 rounded-lg border border-border-default bg-background px-2 text-sm" /></label>
          <label className="grid gap-1 text-xs font-medium text-secondary">Şifre<input name="password" type="password" required minLength={8} className="min-h-10 rounded-lg border border-border-default bg-background px-2 text-sm" /></label>
          <label className="grid gap-1 text-xs font-medium text-secondary">Şifre tekrar<input name="confirmPassword" type="password" required minLength={8} className="min-h-10 rounded-lg border border-border-default bg-background px-2 text-sm" /></label>
          <SubmitButton pendingLabel="Kaydediliyor…" className="min-h-10 self-end rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-500 disabled:cursor-wait disabled:opacity-70">Hesabı kaydet</SubmitButton>
        </ActionForm>
        <div className="mt-3 overflow-hidden rounded-xl border border-border-default bg-surface">
          {guestAccounts.length === 0 ? <p className="p-4 text-sm text-muted">Henüz guest hesabı yok.</p> : guestAccounts.map((account, index) => (
            <div key={account.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${index > 0 ? "border-t border-border-subtle" : ""}`}>
              <span><span className="block text-sm font-semibold text-foreground">{account.brand_name}</span><span className="text-xs text-muted">{account.username} · {account.active === 1 ? "Aktif" : "Pasif"}</span></span>
              <ActionForm action={setGuestAccountActiveAction.bind(null, account.id, account.active !== 1)}><SubmitButton pendingLabel="İşleniyor…" className="rounded-lg border border-border-default px-3 py-2 text-xs font-semibold text-secondary hover:bg-surface-hover disabled:cursor-wait disabled:opacity-60">{account.active === 1 ? "Pasife al" : "Aktifleştir"}</SubmitButton></ActionForm>
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
