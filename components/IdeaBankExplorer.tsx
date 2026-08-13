"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ActionForm from "@/components/ActionForm";
import EmptyState from "@/components/EmptyState";
import SubmitButton from "@/components/SubmitButton";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { createIdeaAction, setIdeaArchivedAction, updateIdeaStatusAction } from "@/lib/actions/ideas";
import { formatDateTime } from "@/lib/date";
import {
  IDEA_CATEGORIES,
  IDEA_CATEGORY_LABEL,
  IDEA_CATEGORY_TONE,
  IDEA_STATUSES,
  IDEA_STATUS_LABEL,
  IDEA_STATUS_TONE,
  ideaTags,
} from "@/lib/ideas";
import type { Brand, IdeaCategory, IdeaStatus, IdeaWithContext } from "@/lib/types";

const ALL = "__all__";
const OFFICE = "__office__";

function searchText(idea: IdeaWithContext): string {
  return [idea.title, idea.body, idea.brand_name, idea.tags_text, idea.source_platform]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");
}

function IdeaScopeBadge({ idea }: { idea: IdeaWithContext }) {
  return idea.scope_type === "office" ? (
    <Badge tone="neutral">Ofis geneli</Badge>
  ) : (
    <Badge tone="brand">{idea.brand_name ?? "Silinmiş marka"}</Badge>
  );
}

export default function IdeaBankExplorer({
  ideas,
  brands,
  archived,
  initialBrandId = "",
  newOpen = false,
}: {
  ideas: IdeaWithContext[];
  brands: Brand[];
  archived: boolean;
  initialBrandId?: string;
  newOpen?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState(initialBrandId || ALL);
  const [category, setCategory] = useState<typeof ALL | IdeaCategory>(ALL);
  const [status, setStatus] = useState<typeof ALL | IdeaStatus>(ALL);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    return ideas.filter((idea) => {
      if (needle && !searchText(idea).includes(needle)) return false;
      if (scope === OFFICE && idea.scope_type !== "office") return false;
      if (scope !== ALL && scope !== OFFICE && idea.brand_id !== scope) return false;
      if (category !== ALL && idea.category !== category) return false;
      if (status !== ALL && idea.status !== status) return false;
      return true;
    });
  }, [category, ideas, query, scope, status]);

  const counts = new Map(IDEA_STATUSES.map((value) => [
    value,
    ideas.filter((idea) => idea.status === value).length,
  ]));
  const filterCount = [query.trim(), scope !== ALL, category !== ALL, status !== ALL].filter(Boolean).length;

  function resetFilters(): void {
    setQuery("");
    setScope(ALL);
    setCategory(ALL);
    setStatus(ALL);
  }

  return (
    <div className="space-y-5">
      {!archived && (
        <section className="grid grid-cols-2 border-y border-border-subtle sm:grid-cols-4" aria-label="Fikir durumu özeti">
          {IDEA_STATUSES.map((ideaStatus, index) => (
            <button
              key={ideaStatus}
              type="button"
              onClick={() => setStatus(status === ideaStatus ? ALL : ideaStatus)}
              className={`ui-press px-3 py-3.5 text-left transition-colors hover:bg-surface-hover sm:px-4 ${index > 0 ? "border-l border-border-subtle" : ""} ${status === ideaStatus ? "bg-surface-subtle" : ""}`}
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">{IDEA_STATUS_LABEL[ideaStatus]}</span>
              <span className="mt-1 block text-xl font-semibold tabular-nums text-foreground">{counts.get(ideaStatus)}</span>
            </button>
          ))}
        </section>
      )}

      {!archived && (
        <details id="yeni-fikir" open={ideas.length === 0 || newOpen} className="group scroll-mt-20 overflow-hidden rounded-xl border border-border-default bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
            <span>
              <span className="block text-sm font-semibold text-foreground">Yeni fikir yakala</span>
              <span className="mt-0.5 block text-xs text-muted">Ham düşünceyi kaydet; geliştirmek için mükemmel olmasını bekleme.</span>
            </span>
            <Icon name="chevron-down" className="size-4 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <ActionForm
            action={createIdeaAction}
            redirectPathPrefix="/ideas/"
            className="grid gap-4 border-t border-border-subtle p-4 sm:p-5 lg:grid-cols-12"
          >
            <input type="hidden" name="status" value="Yeni" />
            <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-3">
              Kapsam
              <Select name="brandId" defaultValue={initialBrandId || "__office__"}>
                <option value="__office__">Ofis geneli</option>
                {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
              </Select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-3">
              Kategori
              <Select name="category" defaultValue="Icerik">
                {IDEA_CATEGORIES.map((value) => <option key={value} value={value}>{IDEA_CATEGORY_LABEL[value]}</option>)}
              </Select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-6">
              Fikir başlığı
              <Input name="title" required maxLength={180} placeholder="Örn. Ürünün seslerinden oluşan ritmik Reels" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-12">
              Fikri anlat
              <Textarea name="body" required maxLength={8000} rows={5} placeholder="Neyi ilginç bulduk, bu fikir nasıl uygulanabilir, hangi duygu veya mesajı taşımalı?" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-7">
              İlham / kaynak bağlantısı <span className="font-normal text-muted">(Instagram, TikTok, Pinterest, YouTube veya web)</span>
              <Input name="sourceUrl" type="url" maxLength={2000} placeholder="https://www.instagram.com/reel/…" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-3">
              Etiketler
              <Input name="tags" maxLength={260} placeholder="reels, ürün, kurgu" />
            </label>
            <div className="flex items-end justify-end lg:col-span-2">
              <SubmitButton pendingLabel="Kaydediliyor…" className="min-h-10 w-full rounded-[10px] bg-brand-600 px-4 text-[13px] font-semibold text-white hover:bg-brand-700">
                Fikri kaydet
              </SubmitButton>
            </div>
          </ActionForm>
        </details>
      )}

      <section className="rounded-xl border border-border-default bg-surface p-3 sm:p-4" aria-label="Fikir filtreleri">
        <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_13rem_11rem_11rem_auto] lg:items-end">
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Ara
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Başlık, açıklama, marka veya etiket…" className="pl-9" />
            </div>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Kapsam
            <Select value={scope} onChange={(event) => setScope(event.target.value)}>
              <option value={ALL}>Tüm kapsamlar</option>
              <option value={OFFICE}>Ofis geneli</option>
              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </Select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Kategori
            <Select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
              <option value={ALL}>Tüm kategoriler</option>
              {IDEA_CATEGORIES.map((value) => <option key={value} value={value}>{IDEA_CATEGORY_LABEL[value]}</option>)}
            </Select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Durum
            <Select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
              <option value={ALL}>Tüm durumlar</option>
              {IDEA_STATUSES.map((value) => <option key={value} value={value}>{IDEA_STATUS_LABEL[value]}</option>)}
            </Select>
          </label>
          <button type="button" onClick={resetFilters} disabled={filterCount === 0} className="ui-press min-h-10 rounded-[10px] px-3 text-xs font-semibold text-secondary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40">
            Temizle {filterCount > 0 ? `· ${filterCount}` : ""}
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{archived ? "Fikir arşivi" : "Fikir akışı"}</h2>
          <p className="mt-0.5 text-xs text-muted"><strong className="text-secondary">{filtered.length}</strong> / {ideas.length} kayıt gösteriliyor</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          compact
          title={ideas.length === 0 ? (archived ? "Arşivde fikir yok" : "Henüz fikir kaydedilmedi") : "Filtrelerle eşleşen fikir yok"}
          description={ideas.length === 0
            ? (archived ? "Arşivlenen fikirler burada saklanacak." : "İlk fikri yukarıdaki hızlı kayıt panelinden ekleyin.")
            : "Aramayı veya filtreleri temizleyerek daha fazla kayıt görebilirsiniz."}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-default bg-surface">
          {filtered.map((idea, index) => (
            <article key={idea.id} className={`grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-center ${index > 0 ? "border-t border-border-subtle" : ""}`}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <IdeaScopeBadge idea={idea} />
                  <Badge tone={IDEA_CATEGORY_TONE[idea.category]}>{IDEA_CATEGORY_LABEL[idea.category]}</Badge>
                  <Badge tone={IDEA_STATUS_TONE[idea.status]}>{IDEA_STATUS_LABEL[idea.status]}</Badge>
                  {idea.source_platform && <span className="text-[10px] font-semibold text-muted">{idea.source_platform} referansı</span>}
                </div>
                <Link href={`/ideas/${idea.id}`} className="group mt-2 block w-fit max-w-full">
                  <h3 className="truncate text-[15px] font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-300">{idea.title}</h3>
                </Link>
                <p className="mt-1 line-clamp-2 max-w-4xl text-[13px] leading-5 text-secondary">{idea.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                  <span>{idea.created_by_name} · {formatDateTime(idea.updated_at)}</span>
                  {idea.source_url && (
                    <a href={idea.source_url} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 hover:underline dark:text-brand-300">
                      Kaynağı aç ↗
                    </a>
                  )}
                  {ideaTags(idea.tags_text).map((tag) => <span key={tag}>#{tag.replace(/\s+/g, "-")}</span>)}
                </div>
              </div>

              {archived ? (
                <ActionForm action={setIdeaArchivedAction.bind(null, idea.id, false)} successMessage="Fikir aktif bankaya geri alındı." className="lg:justify-self-end">
                  <SubmitButton pendingLabel="Geri alınıyor…" className="min-h-9 rounded-[9px] border border-border-default bg-surface px-3 text-xs font-semibold text-secondary hover:bg-surface-hover">
                    Arşivden çıkar
                  </SubmitButton>
                </ActionForm>
              ) : (
                <ActionForm action={updateIdeaStatusAction} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 lg:justify-self-end">
                  <input type="hidden" name="ideaId" value={idea.id} />
                  <Select name="status" defaultValue={idea.status} aria-label={`${idea.title} durumu`} className="min-h-9 py-1 text-xs">
                    {IDEA_STATUSES.map((value) => <option key={value} value={value}>{IDEA_STATUS_LABEL[value]}</option>)}
                  </Select>
                  <SubmitButton pendingLabel="…" className="min-h-9 rounded-[9px] border border-border-default bg-surface px-3 text-xs font-semibold text-secondary hover:bg-surface-hover">
                    Kaydet
                  </SubmitButton>
                </ActionForm>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
