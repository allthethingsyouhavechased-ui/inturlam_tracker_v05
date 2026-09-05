import Link from "next/link";
import MonthlyPointTargetReport from "@/components/MonthlyPointTargetReport";
import { monthParamISO, monthParamToDate } from "@/lib/date";
import { notFound } from "next/navigation";
import PersonAvatar from "@/components/PersonAvatar";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { departmentLabel } from "@/lib/departments";
import { requirePageSession } from "@/lib/identity";
import { listActiveWorkSelections } from "@/lib/repositories/activeWork";
import { getPerson } from "@/lib/repositories/people";

export const dynamic = "force-dynamic";

export default async function PersonProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const current = await requirePageSession();
  const month = monthParamISO(monthParamToDate((await searchParams).month));
  const { personId } = await params;
  const person = getPerson(personId);
  if (!person) notFound();

  const isSelf = current.id === person.id;
  const canEdit = isSelf || current.is_manager === 1;
  const activeWork = listActiveWorkSelections().find((work) => work.person_id === person.id);

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <nav aria-label="Breadcrumb">
        <Link href="/team" className="inline-flex min-h-10 items-center gap-2 rounded-[9px] px-2 text-xs font-semibold text-muted hover:bg-surface-hover hover:text-foreground">
          <Icon name="chevron-left" className="size-4" />
          Ekibe dön
        </Link>
      </nav>

      <header className="flex flex-col gap-5 border-b border-border-subtle pb-7 sm:flex-row sm:items-start">
        <PersonAvatar name={person.name} avatarPath={person.avatar_path} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate text-[30px] font-semibold leading-9 tracking-[-0.035em] text-foreground">
              {person.name}
            </h1>
            {isSelf && <Badge tone="brand">Sen</Badge>}
            {person.is_manager === 1 && <Badge tone="warning">Yönetici</Badge>}
            {person.active === 0 && <Badge tone="neutral">Pasif</Badge>}
          </div>
          <p className="mt-1.5 text-[15px] text-secondary">{person.title ?? "Unvan eklenmemiş"}</p>
          {/* Kullanıcı adı yalnızca kişinin kendisine ve yöneticilere gösteriliyor.
              Giriş ekranı bilerek kişi listesi göstermiyor ve tek jenerik hata
              mesajı veriyor (kullanıcı enumerasyonuna karşı); geçerli kullanıcı
              adlarını tüm ekibe listelemek o kararı sulandırırdı. */}
          {canEdit && (
            <p className="mt-1 text-[13px] text-muted">
              Kullanıcı adı:{" "}
              {person.username ? (
                <span className="font-medium text-secondary">@{person.username}</span>
              ) : (
                <span className="font-medium text-warning">belirlenmedi</span>
              )}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{departmentLabel(person.department)}</span>
            <span aria-hidden="true">·</span>
            <span>{activeWork ? `${activeWork.brand_name} üzerinde çalışıyor` : "Aktif marka seçimi yok"}</span>
          </div>
        </div>
        {canEdit && (
          <Link
            href={`/settings/profile?person=${encodeURIComponent(person.id)}`}
            className={buttonClass({ variant: "secondary", size: "sm" })}
          >
            <Icon name="settings" className="size-4" />
            Bilgileri düzenle
          </Link>
        )}
      </header>
      <MonthlyPointTargetReport month={month} basePath={`/team/${person.id}`} personId={person.id} canManage={current.is_manager === 1} canExport={current.is_manager === 1} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="profile-about" className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted">PROFİL</p>
          <h2 id="profile-about" className="mt-1.5 text-lg font-semibold tracking-[-0.015em]">Hakkında</h2>
          {person.bio ? (
            <p className="mt-4 max-w-2xl whitespace-pre-wrap text-[14px] leading-7 text-secondary">{person.bio}</p>
          ) : (
            <p className="mt-4 text-[13px] leading-6 text-muted">
              Bu profil için henüz kısa bir tanıtım eklenmemiş.
            </p>
          )}
        </section>

        <aside aria-label="Organizasyon bilgileri" className="rounded-xl border border-border-default bg-surface-subtle p-4">
          <h2 className="text-[11px] font-semibold tracking-[0.08em] text-muted">ORGANİZASYON</h2>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-[11px] text-muted">Departman</dt>
              <dd className="mt-1 text-[13px] font-semibold text-foreground">{departmentLabel(person.department)}</dd>
            </div>
            <div className="border-t border-border-subtle pt-4">
              <dt className="text-[11px] text-muted">Rol</dt>
              <dd className="mt-1 text-[13px] font-semibold text-foreground">{person.is_manager === 1 ? "Yönetici" : "Ekip üyesi"}</dd>
            </div>
            <div className="border-t border-border-subtle pt-4">
              <dt className="text-[11px] text-muted">Aktif çalışma</dt>
              <dd className="mt-1 text-[13px] font-semibold text-foreground">
                {activeWork ? (
                  <Link href={`/brands/${activeWork.brand_id}`} className="text-brand-600 hover:text-brand-700 dark:text-brand-300">
                    {activeWork.brand_name} →
                  </Link>
                ) : (
                  "Seçilmemiş"
                )}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
