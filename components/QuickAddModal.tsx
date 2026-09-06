"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/Icon";
import { buttonClass } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Input";
import { quickCreateTaskAction } from "@/lib/actions/quickCreate";
import { quickCreateDefaults, type QuickCreateField, type QuickCreateFieldErrors } from "@/lib/quickCreate";
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
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isClient = useIsClient();
  const [pending, startTransition] = useTransition();
  const pendingRef = useRef(pending);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<QuickCreateFieldErrors>({});
  const requestIdRef = useRef<string | null>(null);
  const defaults = quickCreateDefaults(defaultAssigneeId, defaultDueDate);
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
  const [contentId, setContentId] = useState<string>(defaults.contentId);
  const [newContentTitle, setNewContentTitle] = useState(defaults.newContentTitle);
  const [taskType, setTaskType] = useState(defaults.taskType);
  const [taskTitle, setTaskTitle] = useState(defaults.taskTitle);
  const [priority, setPriority] = useState(defaults.priority);
  const [difficulty, setDifficulty] = useState(defaults.difficulty);
  const [weightPoints, setWeightPoints] = useState(defaults.weightPoints);
  const [assigneeId, setAssigneeId] = useState(defaults.assigneeId);
  const [dueDate, setDueDate] = useState(defaults.dueDate);

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
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]',
      ) ?? []).filter((element) => !element.matches(':disabled, [tabindex="-1"]') && element.getClientRects().length > 0);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    const triggerElement = returnFocusRef.current ?? triggerRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (triggerElement?.isConnected) triggerElement.focus();
    };
  }, [open]);

  function reset() {
    setContentId(defaults.contentId);
    setNewContentTitle(defaults.newContentTitle);
    setTaskType(defaults.taskType);
    setTaskTitle(defaults.taskTitle);
    setPriority(defaults.priority);
    setDifficulty(defaults.difficulty);
    setWeightPoints(defaults.weightPoints);
    setAssigneeId(defaults.assigneeId);
    setDueDate(defaults.dueDate);
    setError(null);
    setFieldErrors({});
    requestIdRef.current = null;
  }

  function fieldError(field: QuickCreateField) {
    return fieldErrors[field] ? <span id={`quickadd-${field}-error`} className="text-xs font-normal text-danger">{fieldErrors[field]}</span> : null;
  }

  function fieldA11y(field: QuickCreateField) {
    return { "aria-invalid": Boolean(fieldErrors[field]), "aria-describedby": fieldErrors[field] ? `quickadd-${field}-error` : undefined };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setError(null);
    setFieldErrors({});
    requestIdRef.current ??= crypto.randomUUID();
    const data = new FormData();
    for (const [name, value] of Object.entries({ requestId: requestIdRef.current, brandId: effectiveBrandId,
      contentItemId: effectiveContentId, newContentTitle, title: taskTitle, contentType: taskType,
      priority, difficulty, weightPoints, assigneeId, dueDate })) data.set(name, value);
    startTransition(async () => {
      try {
        const result = await quickCreateTaskAction(data);
        if (!result.ok) {
          setFieldErrors(result.fieldErrors);
          setError(result.formError);
          return;
        }
        reset();
        setOpen(false);
        setInstant(false);
      } catch {
        setError("Sunucuya ulaşılamadı. Bilgileriniz korundu; aynı işlemi güvenle tekrar deneyebilirsiniz.");
      } finally {
        pendingRef.current = false;
      }
    });
  }

  return (
    <>
      <button ref={triggerRef} type="button" aria-label={triggerLabel} onClick={() => { returnFocusRef.current = triggerRef.current; setOpen(true); }} className={triggerClassName}>
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
                onClick={() => !pendingRef.current && setOpen(false)}
                disabled={pending}
                className="ui-press inline-flex size-9 items-center justify-center rounded-[9px] text-muted hover:bg-surface-hover hover:text-foreground"
                aria-label="Kapat"
              >
                <Icon name="close" className="size-[17px]" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <fieldset disabled={pending} className="min-w-0 space-y-3">
              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Marka
                <select
                  {...fieldA11y("brandId")}
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
              {fieldError("brandId")}
              </label>

              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Bağlı çalışma
                <select
                  {...fieldA11y("contentItemId")}
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
              {fieldError("contentItemId")}
              </label>

              {effectiveContentId === NEW_CONTENT && (
                <div className="rounded-xl border border-dashed border-border-strong bg-surface-subtle p-3">
                  <label className="grid gap-1.5 text-xs font-medium text-secondary">
                    Çalışma / proje başlığı
                    <input
                      {...fieldA11y("newContentTitle")}
                    value={newContentTitle}
                      onChange={(e) => setNewContentTitle(e.target.value)}
                      placeholder="Boşsa görev başlığı kullanılır"
                      className={inputClass}
                    />
                  {fieldError("newContentTitle")}
              </label>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <label className="grid gap-1.5 text-xs font-medium text-secondary">
                  Görev başlığı
                  <input
                    {...fieldA11y("title")}
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="Örn. Kapak görseli hazırla"
                    className={inputClass}
                    autoFocus
                  />
                {fieldError("title")}
              </label>
                <label className="grid gap-1.5 text-xs font-medium text-secondary">
                  Görev türü
                  <select
                    {...fieldA11y("contentType")}
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as ContentType)}
                    className={inputClass}
                  >
                    {CONTENT_TYPES.map((type) => (
                      <option key={type} value={type}>{CONTENT_TYPE_LABEL[type]}</option>
                    ))}
                  </select>
                {fieldError("contentType")}
              </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-6">
                <label className={`min-w-0 grid gap-1.5 text-xs font-medium text-secondary ${canSetWeight ? "sm:col-span-2" : "sm:col-span-3"}`}>
                  Öncelik
                  <select
                    {...fieldA11y("priority")}
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
                {fieldError("priority")}
              </label>
                <label className={`min-w-0 grid gap-1.5 text-xs font-medium text-secondary ${canSetWeight ? "sm:col-span-2" : "sm:col-span-3"}`}>
                  Zorluk
                  <select
                    {...fieldA11y("difficulty")}
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
                {fieldError("difficulty")}
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
                      {...fieldA11y("weightPoints")}
                    value={weightPoints}
                      placeholder={String(DIFFICULTY_DEFAULT_WEIGHT[difficulty])}
                      onChange={(event) => setWeightPoints(event.target.value)}
                      className={inputClass}
                      aria-describedby={fieldErrors.weightPoints ? "quickadd-weight-help quickadd-weightPoints-error" : "quickadd-weight-help"}
                    />
                    <span id="quickadd-weight-help" className="text-[10px] font-normal leading-4 text-muted">
                      Boşsa zorluğa göre {DIFFICULTY_DEFAULT_WEIGHT[difficulty]} puan
                    </span>
                  {fieldError("weightPoints")}
              </label>
                )}
                <label className="min-w-0 grid gap-1.5 text-xs font-medium text-secondary sm:col-span-3">
                  Atanan
                  <select
                    {...fieldA11y("assigneeId")}
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
                {fieldError("assigneeId")}
              </label>
                <label className="min-w-0 grid gap-1.5 text-xs font-medium text-secondary sm:col-span-3">
                  Teslim tarihi
                  <input
                    type="date"
                    required
                    {...fieldA11y("dueDate")}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={inputClass}
                  />
                {fieldError("dueDate")}
              </label>
              </div>

              {error && <p role="alert" className="text-xs text-danger">{error}</p>}

              <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
                <button
                  type="button"
                  onClick={() => !pendingRef.current && setOpen(false)}
                disabled={pending}
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
              </fieldset>
            </form>
          </div>
          </div>,
          document.body,
        )}
    </>
  );
}
