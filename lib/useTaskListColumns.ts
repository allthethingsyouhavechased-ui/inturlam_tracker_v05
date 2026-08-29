"use client";

// Liste görünümünün sütun düzeni: hangi sütunlar açık, hangi SIRADA ve her
// birinin GENİŞLİĞİ. Üçü de `localStorage`'da, görünüm başına ayrı anahtarla
// (/tasks ve /panom farklı listeler, aynı düzeni paylaşmaları gerekmiyor).
//
// Bir dönem yalnızca React state'indeydi: kullanıcı sütunları ayarlayıp göreve
// giriyor, geri döndüğünde seçim gitmiş oluyordu.
//
// Neden `useSyncExternalStore` de `useEffect` + `setState` değil: depo/prop
// senkronizasyonu için efekt yazmak `react-hooks/set-state-in-effect` kuralına
// takılıyor ve fazladan bir render turu demek (bkz. CLAUDE.md, Sidebar notu).
// Sunucu anlık görüntüsü her zaman varsayılan olduğu için ilk boyama SSR ile
// aynı; sapan düzen hydration'dan hemen sonra yerine oturuyor.
//
// Depoda YALNIZCA varsayılandan sapan alanlar durur — `usePanelOpen` ile aynı
// kural: ileride eklenen bir sütun eski bir kayıt yüzünden sessizce kapalı
// gelmesin.

import { useCallback, useSyncExternalStore } from "react";
import type { ListSortKey } from "@/lib/taskSort";

const STORAGE_KEY = "inturlam.ui.taskListColumns";

interface StoredLayout {
  visible?: ListSortKey[];
  order?: ListSortKey[];
  widths?: Partial<Record<ListSortKey, number>>;
}

// 2026-08-29 öncesi kayıtlar düz bir sütun dizisiydi (yalnız görünürlük).
type StoredEntry = ListSortKey[] | StoredLayout;
type StoredState = Record<string, StoredEntry>;

export const MIN_COLUMN_WIDTH = 64;
export const MAX_COLUMN_WIDTH = 720;

let cache: StoredState | null = null;
// getSnapshot HER çağrıda aynı referansı döndürmek zorunda (yoksa React sonsuz
// render'a girer), bu yüzden üretilen Set/dizi/obje'ler imzalarıyla saklanıyor.
const visibleCache = new Map<string, { signature: string; value: ReadonlySet<ListSortKey> }>();
const orderCache = new Map<string, { signature: string; value: readonly ListSortKey[] }>();
const widthCache = new Map<string, { signature: string; value: Readonly<Partial<Record<ListSortKey, number>>> }>();
const defaultVisibleCache = new Map<string, ReadonlySet<ListSortKey>>();
const defaultOrderCache = new Map<string, readonly ListSortKey[]>();
const EMPTY_WIDTHS: Readonly<Partial<Record<ListSortKey, number>>> = Object.freeze({});
const listeners = new Set<() => void>();

function readState(): StoredState {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    cache = parsed && typeof parsed === "object" ? (parsed as StoredState) : {};
  } catch {
    // Gizli sekme / depolama kapalı: düzen o oturum boyunca yaşar.
    cache = {};
  }
  return cache;
}

function entryOf(viewKey: string): StoredLayout {
  const entry = readState()[viewKey];
  if (Array.isArray(entry)) return { visible: entry };
  return entry ?? {};
}

function writeEntry(viewKey: string, next: StoredLayout): void {
  const cleaned: StoredLayout = {};
  if (next.visible) cleaned.visible = next.visible;
  if (next.order) cleaned.order = next.order;
  if (next.widths && Object.keys(next.widths).length > 0) cleaned.widths = next.widths;

  const state = { ...readState() };
  if (Object.keys(cleaned).length === 0) delete state[viewKey];
  else state[viewKey] = cleaned;
  cache = state;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Yazamıyorsak da ekran güncel kalsın; sadece kalıcılık kaybolur.
  }
  for (const listener of listeners) listener();
}

function defaultVisibleFor(viewKey: string, defaults: readonly ListSortKey[]): ReadonlySet<ListSortKey> {
  let value = defaultVisibleCache.get(viewKey);
  if (!value) {
    value = new Set(defaults);
    defaultVisibleCache.set(viewKey, value);
  }
  return value;
}

function defaultOrderFor(viewKey: string, allColumns: readonly ListSortKey[]): readonly ListSortKey[] {
  let value = defaultOrderCache.get(viewKey);
  if (!value) {
    value = [...allColumns];
    defaultOrderCache.set(viewKey, value);
  }
  return value;
}

function visibleSnapshot(viewKey: string, defaults: readonly ListSortKey[]): ReadonlySet<ListSortKey> {
  const stored = entryOf(viewKey).visible;
  if (!Array.isArray(stored) || stored.length === 0) return defaultVisibleFor(viewKey, defaults);
  const signature = stored.join(",");
  const cached = visibleCache.get(viewKey);
  if (cached?.signature === signature) return cached.value;
  const value: ReadonlySet<ListSortKey> = new Set(stored);
  visibleCache.set(viewKey, { signature, value });
  return value;
}

/**
 * Saklanan sıra, sütun listesiyle UZLAŞTIRILIR: tanınmayan anahtarlar atılır,
 * kayıt yazıldıktan sonra eklenen sütunlar sona eklenir. Yoksa yeni bir sütun
 * eski bir kayıt yüzünden hiç görünmezdi.
 */
function orderSnapshot(viewKey: string, allColumns: readonly ListSortKey[]): readonly ListSortKey[] {
  const stored = entryOf(viewKey).order;
  if (!Array.isArray(stored) || stored.length === 0) return defaultOrderFor(viewKey, allColumns);
  const known = new Set(allColumns);
  const reconciled = stored.filter((column) => known.has(column));
  const seen = new Set(reconciled);
  for (const column of allColumns) if (!seen.has(column)) reconciled.push(column);
  const signature = reconciled.join(",");
  const cached = orderCache.get(viewKey);
  if (cached?.signature === signature) return cached.value;
  orderCache.set(viewKey, { signature, value: reconciled });
  return reconciled;
}

function widthSnapshot(viewKey: string): Readonly<Partial<Record<ListSortKey, number>>> {
  const stored = entryOf(viewKey).widths;
  if (!stored || typeof stored !== "object") return EMPTY_WIDTHS;
  const signature = JSON.stringify(stored);
  const cached = widthCache.get(viewKey);
  if (cached?.signature === signature) return cached.value;
  widthCache.set(viewKey, { signature, value: stored });
  return stored;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Başka bir sekmede değiştirilen düzen bu sekmede de geçerli olsun.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    cache = null;
    visibleCache.clear();
    orderCache.clear();
    widthCache.clear();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export interface TaskListLayout {
  /** Sütunların ekrandaki sırası (gizli olanlar dahil). */
  order: readonly ListSortKey[];
  /** Kullanıcının elle ayarladığı genişlikler (px); yoksa varsayılan kullanılır. */
  widths: Readonly<Partial<Record<ListSortKey, number>>>;
  /** `dragged` sütununu `target`'ın önüne taşır. */
  moveColumn: (dragged: ListSortKey, target: ListSortKey) => void;
  setWidth: (column: ListSortKey, width: number) => void;
  /** Sıra ve genişlikleri varsayılana döndürür; görünürlük seçimi korunur. */
  resetLayout: () => void;
}

/**
 * `viewKey` düzenin saklandığı ad — "tasks" ve "panom" ayrı düzen tutar.
 * İlk iki eleman `useState` ile aynı imzayı taşır ki çağıranlar olduğu gibi
 * geçebilsin; üçüncüsü sıra + genişlik kontrolü.
 */
export function useTaskListColumns(
  viewKey: string,
  defaults: readonly ListSortKey[],
  allColumns: readonly ListSortKey[] = defaults,
): readonly [ReadonlySet<ListSortKey>, (next: ReadonlySet<ListSortKey>) => void, TaskListLayout] {
  const visible = useSyncExternalStore(
    subscribe,
    () => visibleSnapshot(viewKey, defaults),
    () => defaultVisibleFor(viewKey, defaults),
  );
  const order = useSyncExternalStore(
    subscribe,
    () => orderSnapshot(viewKey, allColumns),
    () => defaultOrderFor(viewKey, allColumns),
  );
  const widths = useSyncExternalStore(
    subscribe,
    () => widthSnapshot(viewKey),
    () => EMPTY_WIDTHS,
  );

  const setVisible = useCallback(
    (next: ReadonlySet<ListSortKey>) => {
      const list = [...next];
      const isDefault =
        list.length === defaults.length && defaults.every((column) => next.has(column));
      writeEntry(viewKey, { ...entryOf(viewKey), visible: isDefault ? undefined : list });
    },
    [viewKey, defaults],
  );

  const moveColumn = useCallback(
    (dragged: ListSortKey, target: ListSortKey) => {
      if (dragged === target) return;
      const current = [...orderSnapshot(viewKey, allColumns)];
      const from = current.indexOf(dragged);
      const to = current.indexOf(target);
      if (from < 0 || to < 0) return;
      current.splice(from, 1);
      current.splice(current.indexOf(target) + (to > from ? 1 : 0), 0, dragged);
      writeEntry(viewKey, { ...entryOf(viewKey), order: current });
    },
    [viewKey, allColumns],
  );

  const setWidth = useCallback(
    (column: ListSortKey, width: number) => {
      const clamped = Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, width)));
      const entry = entryOf(viewKey);
      writeEntry(viewKey, { ...entry, widths: { ...entry.widths, [column]: clamped } });
    },
    [viewKey],
  );

  const resetLayout = useCallback(() => {
    writeEntry(viewKey, { visible: entryOf(viewKey).visible });
  }, [viewKey]);

  return [visible, setVisible, { order, widths, moveColumn, setWidth, resetLayout }];
}
