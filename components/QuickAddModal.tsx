"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/Icon";
import { buttonClass } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Input";
import { createContentItemAction } from "@/lib/actions/content";
import { createTaskAction } from "@/lib/actions/tasks";
import { loadQuickAddOptionsAction, type QuickAddOptions } from "@/lib/actions/quickAdd";
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABEL,
  TASK_DIFFICULTIES,
  TASK_DIFFICULTY_LABEL,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
} from "@/lib/constants";
import { getActionErrorMessage } from "@/lib/errorMessage";
import { DIFFICULTY_DEFAULT_WEIGHT } from "@/lib/progress";
import { NEW_CONTENT_VALUE, resolveQuickAddContentId } from "@/lib/quickAdd";
import { QUICK_ADD_OPEN_EVENT } from "@/lib/shortcuts";
import type { ContentType } from "@/lib/types";

const NEW_CONTENT = NEW_CONTENT_VALUE;

const NO_OPTIONS: QuickAddOptions = { brands: [], contents: [], people: [] };

const inputClass = controlClass();

// Modal `document.body`'ye portal ediliyor; `initialOpen` ile AÇIK başlayınca
// (takvimden gelen "+" kısayolu) bu sunucu render'ında `document is not
// defined` hatası veriyordu — React sayfayı sessizce istemci render'ına
// düşürüyordu. Sunucuda `false`, istemcide `true` döndüren bu abonelik
// portalı yalnızca tarayıcıda çizer; `useEffect` + `setState` gerektirmez
// (bkz. CLAUDE.md, Sidebar/CollapsiblePanel notları).
const emptySubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export default function QuickAddModal({
  options,
  defaultAssigneeId,
  defaultBrandId,
  canSetWeight = false,
  // Takvimden açıldığında: tıklanan gün teslim tarihi olarak hazır gelir ve
  // modal doğrudan açılır (bkz. app/calendar/page.tsx — orada `key` gün +
  // `yeni` parametresinden türetildiği için her yeni istek yeni bir instance).
  defaultDueDate = "",
  initialOpen = false,
  listenForShortcut = false,
  triggerLabel = "Yeni görev",
  triggerClassName = "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500",
}: {
  /**
   * Açılır listeler. VERİLMEZSE pencere ilk açıldığında kendisi çeker — Header
   * bu yüzden artık hiçbir liste okumuyor. Yalnızca kapsamı daraltmak gerektiğinde
   * geç (marka sayfası tek markayı ve o markanın çalışmalarını veriyor).
   */
  options?: QuickAddOptions;
  defaultAssigneeId: string | null;
  defaultBrandId?: string;
  canSetWeight?: boolean;
  defaultDueDate?: string;
  initialOpen?: boolean;
  /** `N` kısayolunu dinlesin mi? Sayfada tek bir pencere dinlemeli — üst çubuktaki. */
  listenForShortcut?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(initialOpen);
  // Klavyeyle açıldığında giriş animasyonu ATLANIR. Kısayol günde onlarca kez
  // kullanılıyor; 220ms'lik bir giriş, kısayolun kazandırdığı süreyi geri alır
  // ve pencereyi tuşa göre "geç" hissettirir (bkz. lib/shortcuts.ts).
  const [instant, setInstant] = useState(false);
  const [fetched, setFetched] = useState<QuickAddOptions | null>(null);
  const requestedOptionsRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isClient = useIsClient();
  const [pending, startTransition] = useTransition();
  const pendingRef = useRef(pending);
  const [error, setError] = useState<string | null>(null);
  const loadingOptions = !options && !fetched && error === null;

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const { brands, contents, people } = options ?? fetched ?? NO_OPTIONS;
  const [brandId, setBrandId] = useState(defaultBrandId ?? "");
  // Listeler pencere açıldıktan SONRA gelebildiği için seçili marka state'ten
  // değil, state + gelen listeden TÜRETİLİYOR (aynı desen `effectiveContentId`de
  // de var). Prop'u state'e kopyalayıp bir efektle senkronlamak fazladan render
  // turu ve `react-hooks/set-state-in-effect` demek olurdu.
  const effectiveBrandId = brands.some((brand) => brand.id === brandId)
    ? brandId
    : (brands.find((brand) => brand.id === defaultBrandId)?.id ?? brands[0]?.id ?? "");
  const [contentId, setContentId] = useState<string>(NEW_CONTENT);
  const [newContentTitle, setNewContentTitle] = useState("");
  const [taskType, setTaskType] = useState(CONTENT_TYPES[0]);
  const [taskTitle, setTaskTitle] = useState("");
  const [priority, setPriority] = useState(TASK_PRIORITIES[1]);
  const [difficulty, setDifficulty] = useState(TASK_DIFFICULTIES[1]);
  const [weightPoints, setWeightPoints] = useState("");
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId ?? "");
  const [dueDate, setDueDate] = useState(defaultDueDate);

  const contentsForBrand = useMemo(
    () => contents.filter((c) => c.brand_id === effectiveBrandId),
    [contents, effectiveBrandId],
  );

  const effectiveContentId = resolveQuickAddContentId(
    contentId,
    contentsForBrand.map((content) => content.id),
  );

  // `N` kısayolu (yalnızca kısayol katmanının bağlı olduğu ekip kabuğunda).
  useEffect(() => {
    if (!listenForShortcut) return;
    function openFromShortcut() {
      setInstant(true);
      setOpen(true);
    }
    window.addEventListener(QUICK_ADD_OPEN_EVENT, openFromShortcut);
    return () => window.removeEventListener(QUICK_ADD_OPEN_EVENT, openFromShortcut);
  }, [listenForShortcut]);

  // Açılır listeleri ilk açılışta bir kez çek. Trigger'ın onClick'i yerine burada
  // olmasının sebebi `initialOpen`: takvimden gelen "+" kısayolunda hiç tıklama
  // olmadan açık başlıyor.
  //
  // "İstek gönderildi mi" bilgisi STATE DEĞİL REF: efekt gövdesinde senkron
  // `setState` çağırmak `react-hooks/set-state-in-effect`e takılıyor ve fazladan
  // render turu üretiyor. Yükleniyor durumu da state değil, `options`/`fetched`ten
  // TÜRETİLİYOR — yani senkronlanacak ikinci bir doğruluk kaynağı hiç yok.
  useEffect(() => {
    if (!open || options || requestedOptionsRef.current) return;
    requestedOptionsRef.current = true;
    let cancelled = false;
    loadQuickAddOptionsAction()
      .then((next) => {
        if (!cancelled) setFetched(next);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        requestedOptionsRef.current = false;
        setError(getActionErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [open, options]);

  // Modal açıkken Escape ile kapat + arka planın scroll'unu kilitle.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pendingRef.current) {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    const triggerElement = triggerRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      triggerElement?.focus();
    };
  }, [open]);

  function reset() {
    setContentId(NEW_CONTENT);
    setNewContentTitle("");
    setTaskType(CONTENT_TYPES[0]);
    setTaskTitle("");
    setPriority(TASK_PRIORITIES[1]);
    setDifficulty(TASK_DIFFICULTIES[1]);
    setWeightPoints("1");
    setAssigneeId(defaultAssigneeId ?? "");
    setDueDate(defaultDueDate);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!taskTitle.trim()) {
      setError("Görev başlığı zorunlu.");
      return;
    }
    startTransition(async () => {
      try {
        let targetContentId = effectiveContentId;
        if (targetContentId === NEW_CONTENT) {
          const fd = new FormData();
          fd.set("brandId", effectiveBrandId);
          fd.set("title", newContentTitle.trim() || taskTitle.trim());
          fd.set("type", taskType);
          targetContentId = await createContentItemAction(fd);
        }

        const fd2 = new FormData();
        fd2.set("contentItemId", targetContentId);
        fd2.set("title", taskTitle.trim());
        fd2.set("contentType", taskType);
        fd2.set("priority", priority);
        fd2.set("difficulty", difficulty);
        fd2.set("weightPoints", weightPoints);
        if (assigneeId) fd2.set("assigneeId", assigneeId);
        if (dueDate) fd2.set("dueDate", dueDate);
        await createTaskAction(fd2);

        reset();
        setOpen(false);
        setInstant(false);
      } catch (e) {
        setError(getActionErrorMessage(e));
      }
    });
  }

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        <Icon name="plus" className="size-4" />
        <span className="quick-add-label">{triggerLabel}</span>
      </button>

      {open &&
        isClient &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/60 p-4 pt-12 backdrop-blur-[2px] sm:pt-20">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Pencereyi kapat"
            className="absolute inset-0 cursor-default"
            onClick={() => !pending && setOpen(false)}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quickadd-title"
            className={`relative w-full max-w-lg rounded-2xl border border-border-default bg-surface-elevated p-5 shadow-lg ${instant ? "" : "ui-enter"}`}
          >
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-border-subtle pb-4">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">YENİ KAYIT</p>
                <h2 id="quickadd-title" className="mt-1 text-lg font-semibold tracking-[-0.015em]">Görev oluştur</h2>
                <p className="mt-1 text-xs text-muted">Marka, tür, iş yükü ve sorumluyu tek akışta belirle.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ui-press inline-flex size-9 items-center justify-center rounded-[9px] text-muted hover:bg-surface-hover hover:text-foreground"
                aria-label="Kapat"
              >
                <Icon name="close" className="size-[17px]" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Marka
                <select
                  value={effectiveBrandId}
                  disabled={loadingOptions}
                  onChange={(e) => {
                    setBrandId(e.target.value);
                    setContentId(NEW_CONTENT);
                    setTaskType(CONTENT_TYPES[0]);
                  }}
                  className={inputClass}
                >
                  {loadingOptions && <option value="">Yükleniyor…</option>}
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Bağlı çalışma
                <select
                  value={effectiveContentId}
                  onChange={(e) => {
                    const nextContentId = e.target.value;
                    setContentId(nextContentId);
                    const selected = contentsForBrand.find((content) => content.id === nextContentId);
                    setTaskType(selected?.type ?? CONTENT_TYPES[0]);
                  }}
                  className={inputClass}
                >
                  {contentsForBrand.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                  <option value={NEW_CONTENT}>+ Yeni çalışma oluştur</option>
                </select>
              </label>

              {effectiveContentId === NEW_CONTENT && (
                <div className="rounded-xl border border-dashed border-border-strong bg-surface-subtle p-3">
                  <label className="grid gap-1.5 text-xs font-medium text-secondary">
                    Çalışma / proje başlığı
                    <input
                      value={newContentTitle}
                      onChange={(e) => setNewContentTitle(e.target.value)}
                      placeholder="Boşsa görev başlığı kullanılır"
                      className={inputClass}
                    />
                  </label>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <label className="grid gap-1.5 text-xs font-medium text-secondary">
                  Görev başlığı
                  <input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="Örn. Kapak görseli hazırla"
                    className={inputClass}
                    autoFocus
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-secondary">
                  Görev türü
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as ContentType)}
                    className={inputClass}
                  >
                    {CONTENT_TYPES.map((type) => (
                      <option key={type} value={type}>{CONTENT_TYPE_LABEL[type]}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-6">
                <label className={`min-w-0 grid gap-1.5 text-xs font-medium text-secondary ${canSetWeight ? "sm:col-span-2" : "sm:col-span-3"}`}>
                  Öncelik
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as (typeof TASK_PRIORITIES)[number])}
                    className={inputClass}
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {TASK_PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={`min-w-0 grid gap-1.5 text-xs font-medium text-secondary ${canSetWeight ? "sm:col-span-2" : "sm:col-span-3"}`}>
                  Zorluk
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as (typeof TASK_DIFFICULTIES)[number])}
                    className={inputClass}
                  >
                    {TASK_DIFFICULTIES.map((value) => (
                      <option key={value} value={value}>
                        {TASK_DIFFICULTY_LABEL[value]}
                      </option>
                    ))}
                  </select>
                </label>
                {canSetWeight && (
                  <label className="min-w-0 grid gap-1.5 text-xs font-medium text-secondary sm:col-span-2">
                    Puan
                    <input
                      name="weightPoints"
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={weightPoints}
                      placeholder={String(DIFFICULTY_DEFAULT_WEIGHT[difficulty])}
                      onChange={(event) => setWeightPoints(event.target.value)}
                      className={inputClass}
                      aria-describedby="quickadd-weight-help"
                    />
                    <span id="quickadd-weight-help" className="text-[10px] font-normal leading-4 text-muted">
                      Boşsa zorluğa göre {DIFFICULTY_DEFAULT_WEIGHT[difficulty]} puan
                    </span>
                  </label>
                )}
                <label className="min-w-0 grid gap-1.5 text-xs font-medium text-secondary sm:col-span-3">
                  Atanan
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">— kimse —</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 grid gap-1.5 text-xs font-medium text-secondary sm:col-span-3">
                  Teslim tarihi
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              {error && <p role="alert" className="text-xs text-danger">{error}</p>}

              <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={buttonClass({ variant: "ghost" })}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={pending || loadingOptions || brands.length === 0}
                  className={buttonClass({ variant: "primary" })}
                >
                  {pending ? "Oluşturuluyor…" : "Oluştur"}
                </button>
              </div>
            </form>
          </div>
          </div>,
          document.body,
        )}
    </>
  );
}
