"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/Icon";
import { buttonClass } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Input";
import { createContentItemAction } from "@/lib/actions/content";
import { createTaskAction } from "@/lib/actions/tasks";
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABEL,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
} from "@/lib/constants";
import { getActionErrorMessage } from "@/lib/errorMessage";
import { NEW_CONTENT_VALUE, resolveQuickAddContentId } from "@/lib/quickAdd";
import type { Person } from "@/lib/types";

const NEW_CONTENT = NEW_CONTENT_VALUE;

interface BrandOption {
  id: string;
  name: string;
}

interface ContentOption {
  id: string;
  brand_id: string;
  title: string;
}

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
  brands,
  contents,
  people,
  defaultAssigneeId,
  defaultBrandId,
  // Takvimden açıldığında: tıklanan gün teslim tarihi olarak hazır gelir ve
  // modal doğrudan açılır (bkz. app/calendar/page.tsx — orada `key` gün +
  // `yeni` parametresinden türetildiği için her yeni istek yeni bir instance).
  defaultDueDate = "",
  initialOpen = false,
  triggerLabel = "Yeni görev",
  triggerClassName = "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500",
}: {
  brands: BrandOption[];
  contents: ContentOption[];
  people: Person[];
  defaultAssigneeId: string | null;
  defaultBrandId?: string;
  defaultDueDate?: string;
  initialOpen?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(initialOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isClient = useIsClient();
  const [pending, startTransition] = useTransition();
  const pendingRef = useRef(pending);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const initialBrandId = brands.some((brand) => brand.id === defaultBrandId)
    ? (defaultBrandId ?? "")
    : (brands[0]?.id ?? "");
  const [brandId, setBrandId] = useState(initialBrandId);
  const [contentId, setContentId] = useState<string>(NEW_CONTENT);
  const [newContentTitle, setNewContentTitle] = useState("");
  const [newContentType, setNewContentType] = useState(CONTENT_TYPES[0]);
  const [taskTitle, setTaskTitle] = useState("");
  const [priority, setPriority] = useState(TASK_PRIORITIES[1]);
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId ?? "");
  const [dueDate, setDueDate] = useState(defaultDueDate);

  const contentsForBrand = useMemo(
    () => contents.filter((c) => c.brand_id === brandId),
    [contents, brandId],
  );

  const effectiveContentId = resolveQuickAddContentId(
    contentId,
    contentsForBrand.map((content) => content.id),
  );

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
    setTaskTitle("");
    setPriority(TASK_PRIORITIES[1]);
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
          fd.set("brandId", brandId);
          fd.set("title", newContentTitle.trim() || taskTitle.trim());
          fd.set("type", newContentType);
          targetContentId = await createContentItemAction(fd);
        }

        const fd2 = new FormData();
        fd2.set("contentItemId", targetContentId);
        fd2.set("title", taskTitle.trim());
        fd2.set("priority", priority);
        if (assigneeId) fd2.set("assigneeId", assigneeId);
        if (dueDate) fd2.set("dueDate", dueDate);
        await createTaskAction(fd2);

        reset();
        setOpen(false);
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
            className="ui-enter relative w-full max-w-lg rounded-xl border border-border-default bg-surface-elevated p-5 shadow-lg"
          >
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-border-subtle pb-4">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">YENİ KAYIT</p>
                <h2 id="quickadd-title" className="mt-1 text-lg font-semibold tracking-[-0.015em]">Görev oluştur</h2>
                <p className="mt-1 text-xs text-muted">Marka, içerik ve sorumluyu tek akışta belirle.</p>
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
                  value={brandId}
                  onChange={(e) => {
                    setBrandId(e.target.value);
                    setContentId(NEW_CONTENT);
                  }}
                  className={inputClass}
                >
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
                  onChange={(e) => setContentId(e.target.value)}
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
                <div className="grid gap-3 rounded-xl border border-dashed border-border-strong bg-surface-subtle p-3 sm:grid-cols-[1fr_auto]">
                  <label className="grid gap-1.5 text-xs font-medium text-secondary">
                    Çalışma / proje başlığı
                    <input
                      value={newContentTitle}
                      onChange={(e) => setNewContentTitle(e.target.value)}
                      placeholder="Boşsa görev başlığı kullanılır"
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-secondary">
                    Görev türü
                    <select
                      value={newContentType}
                      onChange={(e) => setNewContentType(e.target.value as (typeof CONTENT_TYPES)[number])}
                      className={inputClass}
                    >
                      {CONTENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {CONTENT_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

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

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1.5 text-xs font-medium text-secondary">
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
                <label className="grid gap-1.5 text-xs font-medium text-secondary">
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
                <label className="grid gap-1.5 text-xs font-medium text-secondary">
                  Teslim tarihi
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

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
                  disabled={pending || brands.length === 0}
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
