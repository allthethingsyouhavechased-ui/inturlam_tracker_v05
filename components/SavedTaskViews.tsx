"use client";

import { useState, useSyncExternalStore } from "react";
import Icon from "@/components/ui/Icon";
import {
  MAX_VIEW_NAME_LENGTH,
  filtersToSearch,
  isEmptyFilterState,
  readSavedViews,
  viewToFilters,
  writeSavedViews,
  type SavedTaskView,
} from "@/lib/savedViews";
import type { TaskFilterState } from "@/lib/taskFilterParams";

// Depo okuması `useSyncExternalStore` ile: sunucu anlık görüntüsü hep boş liste
// olduğu için SSR çıktısı sabit, kayıtlı görünümler hydration'dan sonra beliriyor.
// (Aynı gerekçe `CollapsiblePanel` ve `SidebarContext` için de geçerli — efekt +
// setState fazladan render turu ve `react-hooks/set-state-in-effect` demek.)
const listeners = new Set<() => void>();
let cache: SavedTaskView[] | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SavedTaskView[] {
  if (cache === null) cache = readSavedViews();
  return cache;
}

const EMPTY: SavedTaskView[] = [];
const getServerSnapshot = () => EMPTY;

function commit(next: SavedTaskView[]): void {
  cache = next;
  writeSavedViews(next);
  for (const listener of listeners) listener();
}

export default function SavedTaskViews({
  current,
  onApply,
}: {
  current: TaskFilterState;
  onApply: (filters: TaskFilterState) => void;
}) {
  const views = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const currentSearch = filtersToSearch(current);
  const activeId = views.find((view) => view.search === currentSearch)?.id ?? null;
  const canSave = !isEmptyFilterState(current) && activeId === null;

  function save() {
    const trimmed = name.trim().slice(0, MAX_VIEW_NAME_LENGTH);
    if (!trimmed) return;
    commit([...views, { id: crypto.randomUUID(), name: trimmed, search: currentSearch }]);
    setName("");
    setNaming(false);
  }

  if (views.length === 0 && !canSave) {
    return null;
  }

  return (
    <footer
      aria-label="Kaydedilmiş görünümler"
      className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3"
    >
      <span className="text-caption font-medium text-muted">Görünümler:</span>

      {views.map((view) => (
        <span
          key={view.id}
          className={`inline-flex items-center rounded-md border text-xs font-medium ${
            view.id === activeId
              ? "border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-200"
              : "border-border-default bg-surface text-secondary"
          }`}
        >
          <button
            type="button"
            onClick={() => onApply(viewToFilters(view.search))}
            className="ui-press min-h-11 max-w-[12rem] truncate rounded-l-md pl-2.5 pr-1.5 md:min-h-8"
            aria-current={view.id === activeId ? "true" : undefined}
          >
            {view.name}
          </button>
          <button
            type="button"
            onClick={() => commit(views.filter((item) => item.id !== view.id))}
            aria-label={`${view.name} görünümünü sil`}
            className="ui-press inline-flex min-h-11 min-w-11 items-center justify-center rounded-r-md text-muted hover:text-danger md:min-h-8 md:min-w-8"
          >
            <Icon name="close" className="size-3.5" />
          </button>
        </span>
      ))}

      {naming ? (
        <span className="inline-flex items-center gap-1">
          <input
            autoFocus
            value={name}
            maxLength={MAX_VIEW_NAME_LENGTH}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setNaming(false);
                setName("");
              }
            }}
            placeholder="Görünüm adı"
            aria-label="Kayıtlı görünüm adı"
            className="min-h-11 w-40 rounded-md border border-border-default bg-surface px-3 text-xs text-foreground outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 md:min-h-8"
          />
          <button type="button" onClick={save} className="ui-press min-h-11 rounded-md bg-brand-600 px-3 text-xs font-semibold text-white md:min-h-8">
            Kaydet
          </button>
        </span>
      ) : (
        canSave && (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="ui-press inline-flex min-h-11 items-center gap-1 rounded-md border border-dashed border-border-strong px-2.5 text-xs font-medium text-muted hover:border-brand-400 hover:text-brand-600 md:min-h-8 dark:hover:text-brand-300"
          >
            <Icon name="plus" className="size-3.5" />
            Bu filtreyi kaydet
          </button>
        )
      )}
    </footer>
  );
}
