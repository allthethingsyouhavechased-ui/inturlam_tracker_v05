import Link from "next/link";
import { notFound } from "next/navigation";
import ActionForm from "@/components/ActionForm";
import ActivityFeed from "@/components/ActivityFeed";
import SubmitButton from "@/components/SubmitButton";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { setIdeaArchivedAction, updateIdeaAction } from "@/lib/actions/ideas";
import { formatDateTime } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import {
  IDEA_CATEGORIES,
  IDEA_CATEGORY_LABEL,
  IDEA_CATEGORY_TONE,
  IDEA_STATUSES,
  IDEA_STATUS_LABEL,
  IDEA_STATUS_TONE,
  ideaTags,
} from "@/lib/ideas";
import { listActivityForEntity } from "@/lib/repositories/activity";
import { listBrands } from "@/lib/repositories/brands";
import { getIdea } from "@/lib/repositories/ideas";

export const dynamic = "force-dynamic";

export default async function IdeaPage({ params }: { params: Promise<{ ideaId: string }> }) {
  await requirePageSession();
  const { ideaId } = await params;
  const idea = getIdea(ideaId);
  if (!idea) notFound();
  const brands = [...listBrands()].sort((left, right) =>
    left.name.localeCompare(right.name, "tr", { sensitivity: "base" }),
  );
  const activity = listActivityForEntity("idea", idea.id);
  const brandStillAvailable = idea.brand_id && brands.some((brand) => brand.id === idea.brand_id);
  const defaultScope = idea.scope_type === "office"
    ? "__office__"
    : brandStillAvailable
      ? idea.brand_id!
      : "";

  return (
    <div>
      <PageHeader
        eyebrow="FİKİR DETAYI"
        title={idea.title}
        description={`${idea.scope_type === "office" ? "Ofis geneli" : (idea.brand_name ?? "Eski marka")} · ${IDEA_CATEGORY_LABEL[idea.category]}`}
        breadcrumb={[{ label: "Fikir Bankası", href: "/ideas" }, { label: idea.title }]}
        actions={
          <>
            <Link href={idea.archived_at ? "/ideas?view=archive" : "/ideas"} className={buttonClass({ variant: "secondary" })}>
              <Icon name="arrow-right" className="size-4 rotate-180" /> Bankaya dön
            </Link>
            <ActionForm action={setIdeaArchivedAction.bind(null, idea.id, idea.archived_at === null)}>
              <SubmitButton
                pendingLabel={idea.archived_at ? "Geri alınıyor…" : "Arşivleniyor…"}
                className={buttonClass({ variant: idea.archived_at ? "primary" : "secondary" })}
              >
                <Icon name="archive" className="size-4" />
                {idea.archived_at ? "Arşivden çıkar" : "Arşivle"}
              </SubmitButton>
            </ActionForm>
          </>
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0 space-y-5">
          {idea.archived_at ? (
            <section className="rounded-xl border border-border-default bg-surface p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={IDEA_CATEGORY_TONE[idea.category]}>{IDEA_CATEGORY_LABEL[idea.category]}</Badge>
                <Badge tone={IDEA_STATUS_TONE[idea.status]}>{IDEA_STATUS_LABEL[idea.status]}</Badge>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-secondary">{idea.body}</p>
              <p className="mt-4 text-xs text-muted">Bu fikir arşivde olduğu için düzenlemeye kapalı. Geri almak için üstteki düğmeyi kullanın.</p>
            </section>
          ) : (
            <ActionForm action={updateIdeaAction} successMessage="Fikir güncellendi." className="grid gap-4 rounded-xl border border-border-default bg-surface p-4 sm:p-5 lg:grid-cols-12">
              <input type="hidden" name="ideaId" value={idea.id} />
              <div className="border-b border-border-subtle pb-4 lg:col-span-12">
                <h2 className="text-base font-semibold text-foreground">Fikri geliştir</h2>
                <p className="mt-1 text-xs text-muted">İlk düşünceyi kaybetmeden kapsamı, anlatımı ve uygulanabilirlik durumunu netleştirin.</p>
              </div>
              <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-4">
                Kapsam
                <Select name="brandId" required defaultValue={defaultScope}>
                  {!brandStillAvailable && idea.scope_type === "brand" && (
                    <option value="" disabled>Eski marka · {idea.brand_name ?? "bilinmiyor"} — yeniden seçin</option>
                  )}
                  <option value="__office__">Ofis geneli</option>
                  {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                </Select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-4">
                Kategori
                <Select name="category" defaultValue={idea.category}>
                  {IDEA_CATEGORIES.map((value) => <option key={value} value={value}>{IDEA_CATEGORY_LABEL[value]}</option>)}
                </Select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-4">
                Durum
                <Select name="status" defaultValue={idea.status}>
                  {IDEA_STATUSES.map((value) => <option key={value} value={value}>{IDEA_STATUS_LABEL[value]}</option>)}
                </Select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-12">
                Fikir başlığı
                <Input name="title" required maxLength={180} defaultValue={idea.title} />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-12">
                Fikri anlat
                <Textarea name="body" required maxLength={8000} rows={10} defaultValue={idea.body} />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-8">
                İlham / kaynak bağlantısı
                <Input name="sourceUrl" type="url" maxLength={2000} defaultValue={idea.source_url ?? ""} placeholder="https://www.instagram.com/reel/…" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-4">
                Etiketler
                <Input name="tags" maxLength={260} defaultValue={idea.tags_text ?? ""} placeholder="reels, ürün, kurgu" />
              </label>
              <div className="flex justify-end border-t border-border-subtle pt-4 lg:col-span-12">
                <SubmitButton pendingLabel="Kaydediliyor…">Değişiklikleri kaydet</SubmitButton>
              </div>
            </ActionForm>
          )}

          <section className="overflow-hidden rounded-xl border border-border-default bg-surface">
            <div className="border-b border-border-subtle px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-foreground">Fikir hareketleri</h2>
            </div>
            <ActivityFeed entries={activity} showLink={false} emptyText="Bu fikirde henüz kayıtlı hareket yok." />
          </section>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <section className="rounded-xl border border-border-default bg-surface p-4">
            <p className="text-[10px] font-semibold tracking-[0.09em] text-muted">FİKİR ÖZETİ</p>
            <dl className="mt-3 divide-y divide-border-subtle text-xs">
              <div className="flex items-center justify-between gap-3 py-2"><dt className="text-muted">Kapsam</dt><dd className="text-right font-semibold text-foreground">{idea.scope_type === "office" ? "Ofis geneli" : (idea.brand_name ?? "Eski marka")}</dd></div>
              <div className="flex items-center justify-between gap-3 py-2"><dt className="text-muted">Kategori</dt><dd className="font-semibold text-foreground">{IDEA_CATEGORY_LABEL[idea.category]}</dd></div>
              <div className="flex items-center justify-between gap-3 py-2"><dt className="text-muted">Durum</dt><dd><Badge tone={IDEA_STATUS_TONE[idea.status]}>{IDEA_STATUS_LABEL[idea.status]}</Badge></dd></div>
              <div className="flex items-center justify-between gap-3 py-2"><dt className="text-muted">Ekleyen</dt><dd className="font-semibold text-foreground">{idea.created_by_name}</dd></div>
              <div className="flex items-center justify-between gap-3 py-2"><dt className="text-muted">Oluşturuldu</dt><dd className="text-right text-secondary">{formatDateTime(idea.created_at)}</dd></div>
              <div className="flex items-center justify-between gap-3 py-2"><dt className="text-muted">Güncellendi</dt><dd className="text-right text-secondary">{formatDateTime(idea.updated_at)}</dd></div>
            </dl>
          </section>

          {idea.source_url && (
            <section className="rounded-xl border border-border-default bg-surface p-4">
              <p className="text-[10px] font-semibold tracking-[0.09em] text-muted">İLHAM KAYNAĞI</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{idea.source_platform ?? "Web"}</p>
              <a href={idea.source_url} target="_blank" rel="noreferrer" className={buttonClass({ variant: "secondary", size: "sm", className: "mt-3 w-full" })}>
                Kaynağı aç ↗
              </a>
            </section>
          )}

          {ideaTags(idea.tags_text).length > 0 && (
            <section className="rounded-xl border border-border-default bg-surface p-4">
              <p className="text-[10px] font-semibold tracking-[0.09em] text-muted">ETİKETLER</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ideaTags(idea.tags_text).map((tag) => <Badge key={tag} tone="neutral">#{tag.replace(/\s+/g, "-")}</Badge>)}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
