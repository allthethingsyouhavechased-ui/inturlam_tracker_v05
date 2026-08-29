"use client";

// Liste görünümündeki "Sütunlar" seçimi. Bir dönem yalnızca React state'indeydi:
// kullanıcı sütunları ayarlayıp göreve giriyor, geri döndüğünde seçim gitmiş
// oluyordu. Artık `localStorage`'da, görünüm başına ayrı anahtarla (/tasks ve
// /panom farklı listeler, aynı tercihi paylaşmaları gerekmiyor).
//
// Neden `useSyncExternalStore` de `useEffect` + `setState` değil: depo/prop
// senkronizasyonu için efekt yazmak `react-hooks/set-state-in-effect` kuralına
// takılıyor ve fazladan bir render turu demek (bkz. CLAUDE.md, Sidebar notu).
// Sunucu anlık görüntüsü her zaman varsayılan olduğu için ilk boyama SSR ile
// aynı; sapan seçim hydration'dan hemen sonra yerine oturuyor.
//
// Depoda YALNIZCA varsayılandan sapan görünümler durur — `usePanelOpen` ile
// aynı kural: ileride eklenen bir sütun eski bir kayıt yüzünden sessizce kapalı
// gelmesin.

import { useCallback, useSyncExternalStore } from "react";
import type { ListSortKey } from "@/lib/taskSort";

const STORAGE_KEY = "inturlam.ui.taskListColumns";

type StoredColumns = Record<string, ListSortKey[]>;

let cache: StoredColumns | null = null;
// getSnapshot HER çağrıda aynı referansı döndürmek zorunda (yoksa React sonsuz
// render'a girer), bu yüzden üretilen Set'ler burada imzalarıyla saklanıyor.
const setCache = new Map<string, { signature: string; set: ReadonlySet<ListSortKey> }>();
const defaultCache = new Map<string, ReadonlySet<ListSortKey>>();
const listeners = new Set<() => void>();

function readState(): StoredColumns {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    cache = parsed && typeof parsed === "object" ? (parsed as StoredColumns) : {};
  } catch {
    // Gizli sekme / depolama kapalı: seçim o oturum boyunca yaşar.
    cache = {};
  }
  return cache;
}

function defaultSetFor(viewKey: string, defaults: readonly ListSortKey[]): ReadonlySet<ListSortKey> {
  let set = defaultCache.get(viewKey);
  if (!set) {
    set = new Set(defaults);
    defaultCache.set(viewKey, set);
  }
  return set;
}

function snapshot(viewKey: string, defaults: readonly ListSortKey[]): ReadonlySet<ListSortKey> {
  const stored = readState()[viewKey];
  if (!Array.isArray(stored) || stored.length === 0) return defaultSetFor(viewKey, defaults);
  const signature = stored.join(",");
  const cached = setCache.get(viewKey);
  if (cached?.signature === signature) return cached.set;
  const set: ReadonlySet<ListSortKey> = new Set(stored);
  setCache.set(viewKey, { signature, set });
  return set;
}

function writeColumns(
  viewKey: string,
  columns: ReadonlySet<ListSortKey>,
  defaults: readonly ListSortKey[],
): void {
  const list = [...columns];
  const isDefault = list.length === defaults.length && defaults.every((column) => columns.has(column));
  const next = { ...readState() };
  if (isDefault) {
    delete next[viewKey];
    setCache.delete(viewKey);
  } else {
    next[viewKey] = list;
    setCache.set(viewKey, { signature: list.join(","), set: new Set(list) });
  }
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Yazamıyorsak da ekran güncel kalsın; sadece kalıcılık kaybolur.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Başka bir sekmede değiştirilen seçim bu sekmede de geçerli olsun.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    cache = null;
    setCache.clear();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * `viewKey` tercihin saklandığı ad — "tasks" ve "panom" ayrı seçim tutar.
 * `useState` ile aynı imzayı döndürür ki çağıranlar olduğu gibi geçebilsin.
 */
export function useTaskListColumns(
  viewKey: string,
  defaults: readonly ListSortKey[],
): readonly [ReadonlySet<ListSortKey>, (next: ReadonlySet<ListSortKey>) => void] {
  const columns = useSyncExternalStore(
    subscribe,
    () => snapshot(viewKey, defaults),
    () => defaultSetFor(viewKey, defaults),
  );
  const setColumns = useCallback(
    (next: ReadonlySet<ListSortKey>) => writeColumns(viewKey, next, defaults),
    [viewKey, defaults],
  );
  return [columns, setColumns];
}
