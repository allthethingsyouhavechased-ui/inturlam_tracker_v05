import Link from "next/link";
import IdentityLoginForm from "@/components/IdentityLoginForm";
import PersonAvatar from "@/components/PersonAvatar";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import { getCurrentPerson } from "@/lib/identity";
import { listLoginPeople } from "@/lib/repositories/people";

export const dynamic = "force-dynamic";

export default async function TeamLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; changed?: string }>;
}) {
  const { person: selectedId, changed } = await searchParams;
  const people = listLoginPeople();
  const current = await getCurrentPerson();
  const selected = selectedId ? people.find((person) => person.id === selectedId) : undefined;

  if (selected) {
    const needsPasswordSetup = selected.has_password !== 1;
    return (
      <div className="mx-auto max-w-lg py-4 sm:py-8">
        <PageHeader
          eyebrow="GÜVENLİ GİRİŞ"
          title={selected.name}
          description={selected.is_manager === 1 ? "Yönetici hesabı" : selected.title ?? "Ekip hesabı"}
          breadcrumb={[{ label: "Giriş", href: "/whoami" }, { label: "Ekip", href: "/whoami/team" }, { label: selected.name }]}
          media={<PersonAvatar name={selected.name} avatarPath={selected.avatar_path} size="lg" />}
        />
        <section className="space-y-5 rounded-xl border border-border-default bg-surface p-5 sm:p-6">
          {needsPasswordSetup ? (
            <div className="flex gap-3 rounded-[10px] border border-border-default border-l-[3px] border-l-amber-500 bg-surface-subtle p-3 text-sm text-secondary">
              <Icon name="shield" className="mt-0.5 size-[18px] shrink-0 text-warning" />
              <div>
                <p className="font-semibold text-foreground">Bu hesap henüz girişe açık değil.</p>
                <p className="mt-1">Bir yönetici Hesap yönetimi ekranından ilk şifreyi belirlemeli.</p>
              </div>
            </div>
          ) : <IdentityLoginForm personId={selected.id} />}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <PageHeader eyebrow="EKİP GİRİŞİ" title="Hesabını seç" description="Kendi hesabını seçip şifrenle giriş yap." breadcrumb={[{ label: "Giriş", href: "/whoami" }, { label: "Ekip" }]} />
      {changed === "1" && <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Şifren değiştirildi. Yeni şifrenle tekrar giriş yap.</p>}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border-default bg-border-subtle sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {people.map((person) => (
          <Link key={person.id} href={`/whoami/team?person=${encodeURIComponent(person.id)}`} className={`group flex min-h-32 flex-col items-center justify-center gap-2.5 bg-surface p-3 text-center transition-colors hover:bg-surface-hover ${current?.id === person.id ? "ring-2 ring-inset ring-brand-500" : ""}`}>
            <PersonAvatar name={person.name} avatarPath={person.avatar_path} size="lg" />
            <span className="min-w-0 max-w-full"><span className="block truncate text-sm font-semibold text-foreground">{person.name}</span><span className="mt-0.5 block truncate text-[11px] text-muted">{person.is_manager === 1 ? "Yönetici" : person.title ?? "Ekip üyesi"}</span></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
