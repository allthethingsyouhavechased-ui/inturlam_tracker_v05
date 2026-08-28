import {
  EMPTY_TASK_FILTERS,
  parseTaskFilterParams,
  taskFilterSearch,
  type TaskFilterSearchParams,
  type TaskFilterState,
} from "@/lib/taskFilterParams";

// Kayıtlı görünüm = isim + filtre sorgu dizesi. Sunucuda saklanmıyor: bunlar
// kişinin kendi çalışma alışkanlığı ("benim bu haftam", "Marka X gecikmişler"),
// ekiple paylaşılan bir yapılandırma değil. Paylaşmak isteyen adres çubuğundaki
// bağlantıyı gönderiyor — filtreler zaten URL'de (bkz. lib/taskFilterParams.ts).
//
// `localStorage` her okuma/yazmada try/catch içinde: gizli sekmede ve site
// verisi kapalı tarayıcıda erişimin KENDİSİ hata fırlatıyor.
const STORAGE_KEY = "inturlam.taskViews";
const MAX_VIEWS = 12;
export const MAX_VIEW_NAME_LENGTH = 40;

export interface SavedTaskView {
  readonly id: string;
  readonly name: string;
  /** `?brand=...&focus=...` biçiminde; boşsa "filtresiz". */
  readonly search: string;
}

function isView(value: unknown): value is SavedTaskView {
  if (typeof value !== "object" || value === null) return false;
  const view = value as Record<string, unknown>;
  return typeof view.id === "string"
    && typeof view.name === "string"
    && typeof view.search === "string";
}

export function readSavedViews(): SavedTaskView[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isView).slice(0, MAX_VIEWS) : [];
  } catch {
    return [];
  }
}

export function writeSavedViews(views: readonly SavedTaskView[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views.slice(0, MAX_VIEWS)));
  } catch {
    // Yazılamadıysa görünüm bu oturumda çalışmaya devam eder, sadece kalıcı olmaz.
  }
}

/** Sorgu dizesini yeniden doğrulanmış filtre durumuna çevirir. */
export function viewToFilters(search: string): TaskFilterState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return parseTaskFilterParams(Object.fromEntries(params) as TaskFilterSearchParams);
}

export function filtersToSearch(filters: TaskFilterState): string {
  return taskFilterSearch(filters);
}

/** Hiç filtre seçilmemiş mi? Boş bir görünümü kaydetmenin anlamı yok. */
export function isEmptyFilterState(filters: TaskFilterState): boolean {
  return taskFilterSearch(filters) === taskFilterSearch(EMPTY_TASK_FILTERS);
}
