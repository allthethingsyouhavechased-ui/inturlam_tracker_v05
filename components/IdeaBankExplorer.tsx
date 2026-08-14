"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import ActionForm from "@/components/ActionForm";
import BrandLogo from "@/components/BrandLogo";
import EmptyState from "@/components/EmptyState";
import { OPEN_IDEA_DIALOG_EVENT } from "@/components/IdeaCreateButton";
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
import type { Brand, ClusterRow, IdeaCategory, IdeaStatus, IdeaWithContext } from "@/lib/types";

const ALL = "__all__";
const OFFICE = "__office__";
const emptySubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

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

function IdeaCreateDialog({
  open,
  brands,
  defaultBrandId,
  onClose,
}: {
  open: boolean;
  brands: Brand[];
  defaultBrandId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const isClient = useIsClient();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLInputElement>('input[name="title"]')?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open || !isClient) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/65 p-3 pt-6 backdrop-blur-[2px] sm:p-6 sm:pt-12">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Yeni fikir penceresini kapat"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-idea-title"
        aria-describedby="new-idea-description"
        className="ui-enter relative w-full max-w-4xl overflow-hidden rounded-xl border border-border-default bg-surface-elevated shadow-2xl outline-none"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">YENİ KAYIT</p>
            <h2 id="new-idea-title" className="mt-1 text-lg font-semibold tracking-[-0.015em] text-foreground">Yeni fikir</h2>
            <p id="new-idea-description" className="mt-1 text-xs leading-5 text-muted">Ham düşünceyi ve ilham kaynağını kaydet; ayrıntıları daha sonra geliştirebilirsin.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="ui-press inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] text-muted hover:bg-surface-hover hover:text-foreground">
            <Icon name="close" className="size-[17px]" />
          </button>
        </header>

        <ActionForm
          key={defaultBrandId}
          action={createIdeaAction}
          redirectPathPrefix="/ideas/"
          className="grid max-h-[calc(100dvh-8rem)] gap-4 overflow-y-auto p-4 sm:p-6 lg:grid-cols-12"
        >
          <input type="hidden" name="status" value="Yeni" />
          <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-4">
            Kapsam
            <Select name="brandId" defaultValue={defaultBrandId}>
              <option value={OFFICE}>Ofis geneli</option>
              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </Select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-4">
            Kategori
            <Select name="category" defaultValue="Icerik">
              {IDEA_CATEGORIES.map((value) => <option key={value} value={value}>{IDEA_CATEGORY_LABEL[value]}</option>)}
            </Select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-12">
            Fikir başlığı
            <Input name="title" required maxLength={180} placeholder="Örn. Ürünün seslerinden oluşan ritmik Reels" />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-12">
            Fikri anlat
            <Textarea name="body" required maxLength={8000} rows={5} placeholder="Neyi ilginç bulduk, bu fikir nasıl uygulanabilir, hangi duygu veya mesajı taşımalı?" />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-8">
            İlham / kaynak bağlantısı <span className="font-normal text-muted">(Instagram, TikTok, Pinterest, YouTube veya web)</span>
            <Input name="sourceUrl" type="url" maxLength={2000} placeholder="https://www.instagram.com/reel/…" />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-4">
            Etiketler
            <Input name="tags" maxLength={260} placeholder="reels, ürün, kurgu" />
          </label>
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle pt-4 lg:col-span-12">
            <button type="button" onClick={onClose} className="ui-press min-h-10 rounded-[10px] px-4 text-[13px] font-semibold text-secondary hover:bg-surface-hover">
              Vazgeç
            </button>
            <SubmitButton pendingLabel="Kaydediliyor…" className="min-h-10 rounded-[10px] bg-brand-600 px-5 text-[13px] font-semibold text-white hover:bg-brand-700">
              Fikri kaydet
            </SubmitButton>
          </div>
        </ActionForm>
      </div>
    </div>,
    document.body,
  );
}

export default function IdeaBankExplorer({
  ideas,
  brands,
  clusters,
  archived,
  initialBrandId = "",
  newOpen = false,
}: {
  ideas: IdeaWithContext[];
  brands: Brand[];
  clusters: ClusterRow[];
  archived: boolean;
  initialBrandId?: string;
  newOpen?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState(initialBrandId || ALL);
  const [category, setCategory] = useState<typeof ALL | IdeaCategory>(ALL);
  const [status, setStatus] = useState<typeof ALL | IdeaStatus>(ALL);
  const [ideaDialogOpen, setIdeaDialogOpen] = useState(newOpen);

  useEffect(() => {
    function openIdeaDialog() {
      setIdeaDialogOpen(true);
    }

    window.addEventListener(OPEN_IDEA_DIALOG_EVENT, openIdeaDialog);
    return () => window.removeEventListener(OPEN_IDEA_DIALOG_EVENT, openIdeaDialog);
  }, []);

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

  const scopedIdeas = ideas.filter((idea) => {
    if (scope === OFFICE) return idea.scope_type === "office";
    if (scope !== ALL) return idea.brand_id === scope;
    return true;
  });
  const counts = new Map(IDEA_STATUSES.map((value) => [
    value,
    scopedIdeas.filter((idea) => idea.status === value).length,
  ]));
  const filterCount = [query.trim(), scope !== ALL, category !== ALL, status !== ALL].filter(Boolean).length;
  const ideaCountByBrand = new Map(
    brands.map((brand) => [brand.id, ideas.filter((idea) => idea.brand_id === brand.id).length]),
  );
  const officeIdeaCount = ideas.filter((idea) => idea.scope_type === "office").length;
  const knownClusters = new Set(clusters.map((cluster) => cluster.id));
  const brandGroups = [
    ...clusters.map((cluster) => ({
      id: cluster.id,
      label: cluster.label,
      brands: brands.filter((brand) => brand.cluster === cluster.id),
    })),
    {
      id: "__unknown__",
      label: "Kategorisiz",
      brands: brands.filter((brand) => !knownClusters.has(brand.cluster)),
    },
  ].filter((group) => group.brands.length > 0);
  const selectedScopeLabel = scope === ALL
    ? "Tüm fikirler"
    : scope === OFFICE
      ? "Ofis & Genel"
      : brands.find((brand) => brand.id === scope)?.name ?? "Fikirler";

  function chooseScope(nextScope: string): void {
    setQuery("");
    setCategory(ALL);
    setStatus(ALL);
    setScope(nextScope);
    window.requestAnimationFrame(() => {
      document.getElementById("fikir-akisi")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const closeIdeaDialog = useCallback((): void => {
    setIdeaDialogOpen(false);
    if (!newOpen) return;
    const params = new URLSearchParams();
    if (initialBrandId) params.set("brand", initialBrandId);
    router.replace(params.size > 0 ? `/ideas?${params.toString()}` : "/ideas", { scroll: false });
  }, [initialBrandId, newOpen, router]);

  function resetFilters(): void {
    setQuery("");
    setScope(ALL);
    setCategory(ALL);
    setStatus(ALL);
  }

  return (
    <>
      <IdeaCreateDialog
        open={ideaDialogOpen}
        brands={brands}
        defaultBrandId={scope !== ALL && scope !== OFFICE ? scope : OFFICE}
        onClose={closeIdeaDialog}
      />
      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
      <aside aria-labelledby="idea-spaces-title" className="overflow-hidden rounded-xl border border-border-default bg-surface lg:sticky lg:top-20">
        <div className="border-b border-border-subtle px-3.5 py-3">
          <h2 id="idea-spaces-title" className="text-sm font-semibold text-foreground">Fikir alanları</h2>
          <p className="mt-0.5 text-[11px] text-muted">Marka veya genel alan seç.</p>
        </div>
        <div className="max-h-[min(24rem,52vh)] overflow-y-auto p-2 lg:max-h-[calc(100vh-12rem)]">
          <button
            type="button"
            onClick={() => chooseScope(ALL)}
            aria-pressed={scope === ALL}
            className={`ui-press flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left ${scope === ALL ? "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-200" : "text-secondary hover:bg-surface-hover"}`}
          >
            <Icon name="ideas" className="size-4" />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">Tüm fikirler</span>
            <span className="text-[10px] tabular-nums text-muted">{ideas.length}</span>
          </button>
          <button
            type="button"
            onClick={() => chooseScope(OFFICE)}
            aria-pressed={scope === OFFICE}
            className={`ui-press mt-0.5 flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left ${scope === OFFICE ? "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-200" : "text-secondary hover:bg-surface-hover"}`}
          >
            <Icon name="team" className="size-4" />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">Ofis &amp; Genel</span>
            <span className="text-[10px] tabular-nums text-muted">{officeIdeaCount}</span>
          </button>

          {brandGroups.map((group) => (
            <div key={group.id} className="mt-3 border-t border-border-subtle pt-2">
              <h3 className="px-2 pb-1 text-[9px] font-semibold tracking-[0.08em] text-faint">{group.label.toLocaleUpperCase("tr-TR")}</h3>
              {group.brands.map((brand) => {
                const ideaCount = ideaCountByBrand.get(brand.id) ?? 0;
                return (
                  <button
                    key={brand.id}
                    type="button"
                    onClick={() => chooseScope(brand.id)}
                    aria-pressed={scope === brand.id}
                    className={`group mt-0.5 flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left transition-colors ${scope === brand.id ? "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-200" : "text-secondary hover:bg-surface-hover"}`}
                  >
                    <BrandLogo name={brand.name} logoPath={brand.logo_path} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">{brand.name}</span>
                    <span className="text-[10px] tabular-nums text-muted">{ideaCount}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </aside>

      <main className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">SEÇİLİ ALAN</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">{selectedScopeLabel}</h2>
            <p className="mt-0.5 text-xs text-muted">{scopedIdeas.length} fikir · durum ve filtrelere göre incele</p>
          </div>
          {scope !== ALL && (
            <button type="button" onClick={() => chooseScope(ALL)} className="ui-press min-h-9 rounded-[9px] px-3 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/30">
              Tüm alanlara dön
            </button>
          )}
        </div>

      {!archived && (
        <section className="grid grid-cols-2 overflow-hidden rounded-xl border border-border-default bg-surface sm:grid-cols-4" aria-label="Fikir durumu özeti">
          {IDEA_STATUSES.map((ideaStatus, index) => (
            <button
              key={ideaStatus}
              type="button"
              onClick={() => setStatus(status === ideaStatus ? ALL : ideaStatus)}
              className={`ui-press px-3 py-3 text-left transition-colors hover:bg-surface-hover sm:px-4 ${(index % 2) > 0 ? "border-l border-border-subtle" : ""} ${index > 1 ? "border-t border-border-subtle sm:border-t-0" : ""} ${index > 0 ? "sm:border-l sm:border-border-subtle" : ""} ${status === ideaStatus ? "bg-surface-subtle" : ""}`}
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">{IDEA_STATUS_LABEL[ideaStatus]}</span>
              <span className="mt-1 block text-xl font-semibold tabular-nums text-foreground">{counts.get(ideaStatus)}</span>
            </button>
          ))}
        </section>
      )}

      <section className="rounded-xl border border-border-default bg-surface p-3 sm:p-4" aria-label="Fikir filtreleri">
        <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_11rem_11rem_auto] lg:items-end">
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Ara
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Başlık, açıklama, marka veya etiket…" className="pl-9" />
            </div>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary lg:hidden">
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

      <div id="fikir-akisi" className="flex scroll-mt-20 flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{archived ? "Fikir arşivi" : scope === ALL ? "Fikir akışı" : `${selectedScopeLabel} fikirleri`}</h2>
          <p className="mt-0.5 text-xs text-muted"><strong className="text-secondary">{filtered.length}</strong> / {ideas.length} kayıt gösteriliyor</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          compact
          title={scopedIdeas.length === 0
            ? (archived ? "Bu alanda arşivlenmiş fikir yok" : "Bu alanda henüz fikir yok")
            : "Filtrelerle eşleşen fikir yok"}
          description={scopedIdeas.length === 0
            ? (archived ? "Bu alana ait arşivlenmiş fikirler burada görünecek." : "Üstteki “Yeni fikir” düğmesinden bu marka veya alan için ilk fikri ekleyebilirsin.")
            : "Aramayı veya kategori ve durum filtrelerini temizleyerek daha fazla kayıt görebilirsin."}
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
      </main>
      </div>
    </>
  );
}
