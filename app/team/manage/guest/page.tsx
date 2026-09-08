import { notFound } from "next/navigation";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import PageHeader from "@/components/ui/PageHeader";
import { requirePageSession } from "@/lib/identity";
import {
  saveGuestAccountAction,
  setGuestAccountActiveAction,
} from "@/lib/actions/people";
import { listBrandsAlphabetically } from "@/lib/repositories/brands";
import { listGuestAccounts } from "@/lib/repositories/accounts";

export const dynamic = "force-dynamic";

// Guest hesapları bir dönem hesap yönetiminin EN ALTINDA, aktif ve pasif ekip
// listelerinin arkasındaydı; oraya kadar kaydırmayan kimse varlığını fark
// etmiyordu. Ayrı sayfa: hesap yönetiminin başlığındaki düğmeden açılıyor.
export default async function GuestAccountsPage() {
  const currentPerson = await requirePageSession();
  if (currentPerson.is_manager !== 1) notFound();

  const brands = listBrandsAlphabetically();
  const guestAccounts = listGuestAccounts();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        eyebrow="YÖNETİM"
        title="Guest hesapları"
        description="Her marka için en fazla bir ortak guest hesabı bulunur. Aynı marka yeniden kaydedilirse kullanıcı adı ve şifresi yenilenir."
        breadcrumb={[
          { label: "Ekip", href: "/team" },
          { label: "Hesap yönetimi", href: "/team/manage" },
          { label: "Guest hesapları" },
        ]}
      />

      <section aria-labelledby="guest-form-title">
        <h2 id="guest-form-title" className="mb-3 text-sm font-semibold text-foreground">
          Yeni guest hesabı
        </h2>
        <ActionForm
          action={saveGuestAccountAction}
          successMessage="Guest hesabı kaydedildi."
          resetOnSuccess
          feedbackClassName="sm:col-span-2 lg:col-span-5"
          className="grid gap-3 rounded-xl border border-border-default bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <label className="grid gap-1 text-xs font-medium text-secondary">Marka<select name="brandId" required className="min-h-10 rounded-lg border border-border-default bg-background px-2 text-sm"><option value="">Seç</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-medium text-secondary">Kullanıcı adı<input name="username" required minLength={3} maxLength={40} className="min-h-10 rounded-lg border border-border-default bg-background px-2 text-sm" /></label>
          <label className="grid gap-1 text-xs font-medium text-secondary">Şifre<input name="password" type="password" required minLength={8} className="min-h-10 rounded-lg border border-border-default bg-background px-2 text-sm" /></label>
          <label className="grid gap-1 text-xs font-medium text-secondary">Şifre tekrar<input name="confirmPassword" type="password" required minLength={8} className="min-h-10 rounded-lg border border-border-default bg-background px-2 text-sm" /></label>
          <SubmitButton pendingLabel="Kaydediliyor…" className="min-h-10 self-end rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-500 disabled:cursor-wait disabled:opacity-70">Hesabı kaydet</SubmitButton>
        </ActionForm>
      </section>

      <section className="mt-8" aria-labelledby="guest-accounts-title">
        <h2 id="guest-accounts-title" className="mb-3 text-sm font-semibold text-foreground">
          Kayıtlı hesaplar <span className="font-normal text-muted">· {guestAccounts.length}</span>
        </h2>
        <div className="overflow-hidden rounded-xl border border-border-default bg-surface">
          {guestAccounts.length === 0 ? <p className="p-4 text-sm text-muted">Henüz guest hesabı yok.</p> : guestAccounts.map((account, index) => (
            <div key={account.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${index > 0 ? "border-t border-border-subtle" : ""}`}>
              <span><span className="block text-sm font-semibold text-foreground">{account.brand_name}</span><span className="text-xs text-muted">{account.username} · {account.active === 1 ? "Aktif" : "Pasif"}</span></span>
              <ActionForm action={setGuestAccountActiveAction.bind(null, account.id, account.active !== 1)}><SubmitButton pendingLabel="İşleniyor…" className="rounded-lg border border-border-default px-3 py-2 text-xs font-semibold text-secondary hover:bg-surface-hover disabled:cursor-wait disabled:opacity-60">{account.active === 1 ? "Pasife al" : "Aktifleştir"}</SubmitButton></ActionForm>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
